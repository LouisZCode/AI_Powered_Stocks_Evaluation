
import os
from dotenv import load_dotenv
load_dotenv()


SEC_IDENTITY= "Juan Perez juan.perezzgz@hotmail.com"
DB_URL = os.getenv("DATABASE_URL")

# Stripe
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
STRIPE_PRICES = {
    "hobbyist": os.getenv("STRIPE_PRICE_HOBBYIST"),
    "investor": os.getenv("STRIPE_PRICE_INVESTOR"),
    "trader":   os.getenv("STRIPE_PRICE_TRADER"),
}
STRIPE_PRICE_TOKEN_TOPUP = os.getenv("STRIPE_PRICE_TOKEN_TOPUP")