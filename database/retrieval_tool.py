from langchain.tools import tool

from .connection import get_connection
from .embeddings import embed_query

@tool
def retrieval_tool(query : str) -> str:
    """
    Search SEC 10-Q quarterly financial filings for a company.
    Query with the ticker symbol to get financial data about earnings, revenue, growth, etc.
    """

    if len(query.split()) <= 5:
        query = f"{query} financial strength and earnings revenue growth"

    query_embedding = embed_query(query)

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT content, ticker, year, quarter
        FROM chunks
        ORDER BY embedding <-> %s::vector
        LIMIT %s
    """, (query_embedding, 5)
    )
    
    results = cur.fetchall()
    cur.close()
    conn.close()

    if not results:
        return "No data found in database for this query."
    
    # Format for the LLM to read
    output = ""
    for content, ticker, year, quarter in results:
        output += f"\n[{ticker} {quarter} {year}]\n{content}\n"
    
    return output