from fastapi import APIRouter, Depends, HTTPException, Request
from authlib.integrations.starlette_client import OAuth

import os
import httpx
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database.connection import get_db
from database.orm import User, OauthProvider

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


@router.get("/github/login")
async def github_login(request: Request):
    redirect_uri = request.url_for("auth_callback")
    return await oauth.github.authorize_redirect(request, redirect_uri)


@router.get("/github/callback", name="auth_callback")
async def auth_callback(request: Request, db: AsyncSession = Depends(get_db)):

    token = await oauth.github.authorize_access_token(request)
    access_token = token["access_token"]

    # GitHub doesn't embed userinfo in token — fetch from API
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
        user_resp = await client.get("https://api.github.com/user", headers=headers)
        user_resp.raise_for_status()
        user_info = user_resp.json()

        # Email may be private — fetch from /user/emails
        email = user_info.get("email")
        if not email:
            emails_resp = await client.get("https://api.github.com/user/emails", headers=headers)
            emails_resp.raise_for_status()
            emails = emails_resp.json()
            primary = next((e for e in emails if e.get("primary")), None)
            email = primary["email"] if primary else emails[0]["email"]

    github_id = str(user_info["id"])
    name = user_info.get("name") or user_info.get("login", "")

    # Check if this GitHub account is already linked
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

    # Return user data — JWT will be wired separately
    return {
        "user_id": str(user.id),
        "email": user.email,
        "name": user.name,
        "tier": user.tier,
    }
