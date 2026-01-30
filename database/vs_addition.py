# Test using in terminal:   python -m database.vs_addition

from edgar import Company, set_identity
import re

from langchain_text_splitters import RecursiveCharacterTextSplitter

from datetime import datetime

from .embeddings import embed_chunks
from .connection import get_connection

from tqdm import tqdm

BOILERPLATE_BLOCKLIST = [
    "Indicate by check mark",
    "Large accelerated filer",
    "Smaller reporting company",
    "Emerging growth company",
    "filed all reports required to be filed",
    "Securities Exchange Act of 1934",
    "incorporated by reference",
    "www.sec.gov",
    "I.R.S. Employer Identification",
    "internal control over financial reporting",
    "Principal Accounting Officer",
    "Principal Financial Officer",
    "SIGNATURES",
    "Pursuant to the requirements of",
    "Exhibit Number",
    "Exhibit 31",
    "Exhibit 32",
    "forward-looking statements",
    "UNITED STATES",
    "SECURITIES AND EXCHANGE COMMISSION",
    "Washington, D.C.",
    "FORM 10-Q",
    "FORM 10-K",
    "Filed herewith",
    "Furnished herewith",
    "TABLE OF CONTENTS",
    "Insider Trading Arrangements",
    "Rule 10b5-1",
    "trading plan",
    "Mine Safety Disclosures",
    "Not applicable",
    "Defaults Upon Senior Securities",
    "Inline XBRL",
    "31.1*",
    "32.1*",
    "101*",
    "104*",
]

set_identity("Juan Perez juan.perezzgz@hotmail.com")


def _get_fiscal_quarter(period_of_report: str, fiscal_year_end: str):
    """
    helper function to give the correct parsed quarter and year to metadata
    """
    por = datetime.strptime(period_of_report, '%Y-%m-%d')
    fy_end_month = int(fiscal_year_end[:2])
    fy_start_month = (fy_end_month % 12) + 1

    months_into_fy = (por.month - fy_start_month) % 12
    fiscal_quarter = (months_into_fy // 3) + 1

    fiscal_year = por.year + 1 if por.month > fy_end_month else por.year

    return f'Q{fiscal_quarter}', fiscal_year


def add_clean_fillings_to_database(ticker : str):
    """
    This function 1.- Gets the fillings form the SEC directly, cleans and chunks them, adds metadata and 
    adds to the database both semantically + vectorized
    """

    company = Company(ticker)
    filings = company.get_filings(form=["10-Q", "10-K"]).latest(8)                            #Change int number to get the last N filings per quarter. For project, 8 (2 years)

    if not filings:
        print(f"No SEC filings found for ticker '{ticker}'. It may not be a US-listed company.")
        return None

    print(f"Found {len(filings)} filings for {ticker}. Processing...")
    print()

    conn = get_connection()
    cur = conn.cursor()

    #We also check first that the ticker was not already searched in the database.
    cur.execute("SELECT COUNT(*) FROM chunks WHERE ticker = %s", (ticker,))
    count = cur.fetchone()[0]

    if count > 0:
        print(f"✅ {ticker} already in database ({count} chunks). Skipping SEC fetch.")
        print()
        cur.close()
        conn.close()
        return {"status": "exists", "chunks": count}

    for filing in tqdm(filings, desc=f"Processing {ticker} Reports", unit="filing"):
    
        markdown = filing.markdown()
        markdown = re.sub(r'<[^>]+>', '', markdown)
        markdown = re.sub(r'\n.*\| Q\d 20\d{2} Form 10-[QK] \| \d+', '', markdown)
        markdown.strip()

        #See one of the fillings after regex:
        #print(markdown)

        splitter= RecursiveCharacterTextSplitter(
            chunk_size=1500,
            chunk_overlap=200,
            separators=["\n## ", "\n### ", "\n#### ", "\n\n", "\n", " "  ]
        )

        all_chunks = splitter.split_text(markdown)
        #print(f"All chunkd quantity: {len(all_chunks)}")

        #this gives back a list, we can see elements of that list:
        #for i , chunk in enumerate(all_chunks[:5]):
        #   print(f"\n--- Chunk {i+1} ---")
        #  print(f"Content: {chunk}")

        filtered_chunks = [chunk for chunk in all_chunks if len(chunk) >= 100 and not any(phrase in chunk for phrase in BOILERPLATE_BLOCKLIST)]
        #print(f"Filtered chunkds quantity: {len(filtered_chunks)}")
        print()

        """
        print("FIRST 5 CHUNKS")
        for i , chunk in enumerate(filtered_chunks[:5]):
            print(f"\n--- Chunk {i+1} ---")
            print(f"Content: {chunk}")

        print("LAST 5 CHUNKS")
        for i , chunk in enumerate(filtered_chunks[-5:]):
            print(f"\n--- Chunk {i+1} ---")
            print(f"Content: {chunk}")
        """

        #now we can save these filtered chunks in the database:
        #edgar tools has a .period_of_report that we can use


        por = filing.period_of_report
        fy_end = filing.header.filers[0].company_information.fiscal_year_end

        quarter, year = _get_fiscal_quarter(por, fy_end)
        cur.execute("""
        SELECT COUNT(*) FROM chunks 
        WHERE ticker = %s AND year = %s AND quarter = %s
        """, (ticker, year, quarter))
    
        if cur.fetchone()[0] > 0:
            print(f"⏭️ Skipping {quarter} {year} — already in DB")
            continue

        parsed_date = datetime.strptime(por, '%Y-%m-%d').date()

        #From that data given by edgartools, we get this for the database:
        metadata={"ticker" : ticker, "filing_date" : parsed_date, "year" : year, "quarter" : quarter}

        #print("Metadata added to each chunk:")
        #print(metadata)
        #print()

        embeddings = embed_chunks(filtered_chunks)

        for chunk, embedding in tqdm(zip(filtered_chunks, embeddings), desc=f"Processing {quarter} of {year}", unit="filing"):
            cur.execute("""
                INSERT INTO chunks (content, embedding, ticker, filing_date, year, quarter)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                chunk,
                embedding,
                metadata["ticker"],
                metadata["filing_date"],
                metadata["year"],
                metadata["quarter"]
            ))

    conn.commit()
    cur.close()
    conn.close()
    print("connection closed")
    print()


add_clean_fillings_to_database("TSLA")