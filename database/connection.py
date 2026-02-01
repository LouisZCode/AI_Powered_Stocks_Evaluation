from config import DB_URL

import psycopg2
from psycopg2.extras import RealDictCursor


def get_connection():
    conn = psycopg2.connect(DB_URL)
    print("connection stablished")
    return conn

# a simple function to test the connection is working as desired
def test_connection():
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT version();")
        result = cur.fetchone()
        cur.close()
        conn.close()
        print("✅ Connected!")
        print(f"PostgreSQL: {result['version'][:50]}...")
        return True
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

#test_connection()