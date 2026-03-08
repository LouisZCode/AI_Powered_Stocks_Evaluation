import os
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel as PydanticBaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database.connection import get_db
from database.orm import User
from dependencies.oauth import get_current_user
from config import STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICES, STRIPE_PRICE_TOKEN_TOPUP

router = APIRouter(prefix="/payments")

stripe.api_key = STRIPE_SECRET_KEY

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

TIER_TOKENS = {"free": 70, "hobbyist": 500, "investor": 1200, "trader": 2500}

# ── Request Models ──

class CheckoutRequest(PydanticBaseModel):
    tier: str | None = None
    topup_tokens: int | None = None


# ── Helpers ──

async def get_or_create_stripe_customer(user: User, db: AsyncSession) -> str:
    if user.stripe_customer_id:
        return user.stripe_customer_id

    customer = stripe.Customer.create(email=user.email, metadata={"user_id": str(user.id)})

    result = await db.execute(select(User).where(User.id == user.id).with_for_update())
    locked_user = result.scalar_one()
    locked_user.stripe_customer_id = customer.id
    await db.commit()
    await db.refresh(locked_user)

    return customer.id


# ── Endpoints ──

@router.post("/checkout")
async def create_checkout_session(
    body: CheckoutRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    customer_id = await get_or_create_stripe_customer(user, db)

    if body.tier and body.tier in STRIPE_PRICES:
        price_id = STRIPE_PRICES[body.tier]
        if not price_id:
            raise HTTPException(status_code=400, detail=f"Price not configured for tier: {body.tier}")

        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            metadata={"user_id": str(user.id), "tier": body.tier},
            success_url=f"{FRONTEND_URL}/pricing?success=true",
            cancel_url=f"{FRONTEND_URL}/pricing?cancelled=true",
        )
        return {"checkout_url": session.url}

    elif body.topup_tokens and body.topup_tokens > 0:
        if not STRIPE_PRICE_TOKEN_TOPUP:
            raise HTTPException(status_code=400, detail="Token top-up price not configured")

        # Each unit = 10 tokens, so quantity = topup_tokens / 10
        quantity = max(1, body.topup_tokens // 10)

        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="payment",
            line_items=[{"price": STRIPE_PRICE_TOKEN_TOPUP, "quantity": quantity}],
            metadata={"user_id": str(user.id), "topup_tokens": str(quantity * 10)},
            success_url=f"{FRONTEND_URL}/pricing?success=true",
            cancel_url=f"{FRONTEND_URL}/pricing?cancelled=true",
        )
        return {"checkout_url": session.url}

    raise HTTPException(status_code=400, detail="Provide either 'tier' or 'topup_tokens'")


@router.post("/portal")
async def create_portal_session(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account found")

    session = stripe.billing_portal.Session.create(
        customer=user.stripe_customer_id,
        return_url=f"{FRONTEND_URL}/pricing",
    )
    return {"portal_url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(data, db)
    elif event_type == "invoice.paid":
        await _handle_invoice_paid(data, db)
    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_deleted(data, db)

    return {"status": "ok"}


# ── Webhook Handlers ──

async def _find_user(data: dict, db: AsyncSession) -> User | None:
    """Find user by stripe_customer_id, fallback to metadata.user_id."""
    customer_id = data.get("customer")
    if customer_id:
        result = await db.execute(
            select(User).where(User.stripe_customer_id == customer_id).with_for_update()
        )
        user = result.scalar_one_or_none()
        if user:
            return user

    user_id = (data.get("metadata") or {}).get("user_id")
    if user_id:
        result = await db.execute(
            select(User).where(User.id == user_id).with_for_update()
        )
        return result.scalar_one_or_none()

    return None


async def _handle_checkout_completed(data: dict, db: AsyncSession):
    user = await _find_user(data, db)
    if not user:
        return

    mode = data.get("mode")
    metadata = data.get("metadata") or {}

    if mode == "subscription":
        tier = metadata.get("tier", "hobbyist")
        subscription_id = data.get("subscription")

        # Idempotent: skip if already on this tier with this subscription
        if user.stripe_subscription_id == subscription_id and user.tier == tier:
            await db.commit()
            return

        user.tier = tier
        user.stripe_subscription_id = subscription_id
        user.token_balance = TIER_TOKENS.get(tier, 70)
        await db.commit()

    elif mode == "payment":
        topup_tokens = int(metadata.get("topup_tokens", "0"))
        if topup_tokens > 0:
            user.token_balance += topup_tokens
            await db.commit()


async def _handle_invoice_paid(data: dict, db: AsyncSession):
    # Skip the first invoice (handled by checkout.session.completed)
    billing_reason = data.get("billing_reason")
    if billing_reason == "subscription_create":
        return

    customer_id = data.get("customer")
    if not customer_id:
        return

    result = await db.execute(
        select(User).where(User.stripe_customer_id == customer_id).with_for_update()
    )
    user = result.scalar_one_or_none()
    if not user or user.tier == "free":
        if user:
            await db.commit()
        return

    # Monthly refill: reset to tier allocation
    user.token_balance = TIER_TOKENS.get(user.tier, 70)
    await db.commit()


async def _handle_subscription_deleted(data: dict, db: AsyncSession):
    customer_id = data.get("customer")
    if not customer_id:
        return

    result = await db.execute(
        select(User).where(User.stripe_customer_id == customer_id).with_for_update()
    )
    user = result.scalar_one_or_none()
    if not user:
        return

    user.tier = "free"
    user.token_balance = TIER_TOKENS["free"]
    user.stripe_subscription_id = None
    await db.commit()
