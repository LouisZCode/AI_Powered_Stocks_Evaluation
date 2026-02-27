from datetime import timedelta
from difflib import restore
from fastapi import APIRouter, Depends, HTTPException, Request
from authlib.integrations.starlette_client import OAuth

import os
from fastapi.responses import RedirectResponse
import httpx
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database.connection import get_db
from database.orm import User, OauthProvider

from jose import jwt
from datetime import datetime, timedelta, timezone

from dependencies.oauth import get_current_user


load_dotenv()

router = APIRouter(prefix="/auth")

oauth = OAuth()
oauth.register(
    name="github",
    client_id=os.getenv("GITHUB_CLIENT_ID"),
    client_secret=os.getenv("GITHUB_CLIENT_SECRET"),
    authorize_url="https://github.com/login/oauth/authorize",
    access_token_url="https://github.com/login/oauth/access_token",
    client_kwargs={"scope": "user:email"},
)

oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 30

@router.get("/github/login")
async def github_login(request: Request):
    redirect_uri = request.url_for("auth_callback")
    return await oauth.github.authorize_redirect(request, redirect_uri)


@router.get("/github/callback", name="auth_callback")
async def auth_callback(request: Request, db: AsyncSession = Depends(get_db)):

    token = await oauth.github.authorize_access_token(request)
    access_token = token["access_token"]

    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
        user_resp = await client.get("https://api.github.com/user", headers=headers)
        user_resp.raise_for_status()
        user_info = user_resp.json()

        email = user_info.get("email")
        if not email:
            emails_resp = await client.get("https://api.github.com/user/emails", headers=headers)
            emails_resp.raise_for_status()
            emails = emails_resp.json()
            primary = next((e for e in emails if e.get("primary")), None)
            email = primary["email"] if primary else emails[0]["email"]

    github_id = str(user_info["id"])
    name = user_info.get("name") or user_info.get("login", "")

    result = await db.execute(
        select(OauthProvider).where(
            OauthProvider.provider == "github",
            OauthProvider.provider_user_id == github_id,
        )
    )
    oauth_account = result.scalar_one_or_none()

    if oauth_account:
        user_result = await db.execute(select(User).where(User.id == oauth_account.user_id))
        user = user_result.scalar_one()
    else:
        user_result = await db.execute(select(User).where(User.email == email))
        existing_user = user_result.scalar_one_or_none()

        if existing_user:
            user = existing_user
        else:
            user = User(email=email, name=name, tier="hobbyist", token_balance=50)
            db.add(user)
            await db.flush()

        oauth_account = OauthProvider(
            user_id=user.id,
            provider="github",
            provider_user_id=github_id,
        )
        db.add(oauth_account)
        await db.commit()
        await db.refresh(user)

    jwt_payload = {
        "sub": str(user.id),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    }
    
    jwt_token = jwt.encode(jwt_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    response = RedirectResponse(url=FRONTEND_URL)
    response.set_cookie(
        key="agora_token",
        value=jwt_token,
        httponly=True,
        max_age=60 * 60 * 24 * JWT_EXPIRATION_DAYS,
        samesite="lax",
        )


    return response


@router.get("/google/login")
async def google_login(request: Request):
    redirect_uri = request.url_for("google_auth_callback")
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback", name="google_auth_callback")
async def google_auth_callback(request: Request, db: AsyncSession = Depends(get_db)):
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get("userinfo")

    google_id = str(user_info["sub"])
    email = user_info["email"]
    name = user_info.get("name", "")

    result = await db.execute(
        select(OauthProvider).where(
            OauthProvider.provider == "google",
            OauthProvider.provider_user_id == google_id,
        )
    )
    oauth_account = result.scalar_one_or_none()

    if oauth_account:
        user_result = await db.execute(select(User).where(User.id == oauth_account.user_id))
        user = user_result.scalar_one()
    else:
        user_result = await db.execute(select(User).where(User.email == email))
        existing_user = user_result.scalar_one_or_none()

        if existing_user:
            user = existing_user
        else:
            user = User(email=email, name=name, tier="hobbyist", token_balance=50)
            db.add(user)
            await db.flush()

        oauth_account = OauthProvider(
            user_id=user.id,
            provider="google",
            provider_user_id=google_id,
        )
        db.add(oauth_account)
        await db.commit()
        await db.refresh(user)

    jwt_payload = {
        "sub": str(user.id),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS),
    }

    jwt_token = jwt.encode(jwt_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    response = RedirectResponse(url=FRONTEND_URL)
    response.set_cookie(
        key="agora_token",
        value=jwt_token,
        httponly=True,
        max_age=60 * 60 * 24 * JWT_EXPIRATION_DAYS,
        samesite="lax",
    )

    return response


@router.get("/logout")
async def logout():
    response = RedirectResponse(url=FRONTEND_URL)
    response.delete_cookie(key="agora_token")
    return response


from pydantic import BaseModel as PydanticBaseModel

class DeductRequest(PydanticBaseModel):
    models: list[str]

@router.post("/deduct-tokens")
async def deduct_tokens(
    request: DeductRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    cost = sum(5 if m.endswith("_deep") else 2 for m in request.models)

    result = await db.execute(
        select(User).where(User.id == user.id).with_for_update()
    )
    locked_user = result.scalar_one()

    if locked_user.token_balance < cost:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient tokens. Need {cost}, have {locked_user.token_balance}."
        )

    locked_user.token_balance -= cost
    await db.commit()
    await db.refresh(locked_user)

    return {"token_balance": locked_user.token_balance}


class DeductDebateRequest(PydanticBaseModel):
    metrics_count: int
    rounds: int

@router.post("/deduct-debate")
async def deduct_debate_tokens(
    request: DeductDebateRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    cost = request.metrics_count * request.rounds  # Formula A

    result = await db.execute(
        select(User).where(User.id == user.id).with_for_update()
    )
    locked_user = result.scalar_one()

    if locked_user.token_balance < cost:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient tokens. Need {cost}, have {locked_user.token_balance}."
        )

    locked_user.token_balance -= cost
    await db.commit()
    await db.refresh(locked_user)

    return {"token_balance": locked_user.token_balance, "cost": cost}


@router.get("/me/")
async def get_me(user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401, detail="Not Authenticated")
    return {
        "name" : user.name,
        "email" : user.email,
        "tier" : user.tier,
        "token_balance" : user.token_balance
    }