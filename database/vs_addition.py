from edgar import Company, set_identity
import re

from edgar.core import R
from langchain_text_splitters import RecursiveCharacterTextSplitter

from datetime import datetime

set_identity("Juan Perez juan.perezzgz@hotmail.com")

ticker = input("Write the ticker you want to research:\n")
company = Company(ticker)
filings = company.get_filings(form="10-Q").latest()

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

markdown = filings.markdown()
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
print(f"All chunkd quantity: {len(all_chunks)}")
#this gives back a list, we can see elements of that list:
#for i , chunk in enumerate(all_chunks[:5]):
 #   print(f"\n--- Chunk {i+1} ---")
  #  print(f"Content: {chunk}")

filtered_chunks = [chunk for chunk in all_chunks if len(chunk) >= 100 and not any(phrase in chunk for phrase in BOILERPLATE_BLOCKLIST)]

"""
print(f"Filtered chunkds quantity: {len(filtered_chunks)}")
print()

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

def get_quarter(month) -> str:
    """Convert month to quarter"""
    if month <= 3:
        return "Q1"
    elif month <= 6:
        return "Q2"
    elif month <= 9:
        return "Q3"
    else:
        return "Q4"

por = filings.period_of_report 
parsed = datetime.strptime(por, '%Y-%m-%d')

year = parsed.year  
month = parsed.month 

period = filings.period_of_report
data={"ticker" : ticker, "filling_date" : period, "year" : "period.year", "quaerter" : get_quarter(month)}

print(data)