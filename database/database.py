import os
from dotenv import load_dotenv

import psycopg2

load_dotenv()

db = os.getenv("DATABASE_URL")

def get_connection():
    conn = psycopg2.connect(db)
    print("connection stablished")
    return conn

get_connection()