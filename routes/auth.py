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
        user = User(email=email, name=name)
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