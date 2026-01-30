from edgar import Company, set_identity
import re

from langchain_text_splitters import RecursiveCharacterTextSplitter

set_identity("Juan Perez juan.perezzgz@hotmail.com")

company = Company("AAPL")
filings = company.get_filings(form="10-Q").latest()

markdown = filings.markdown()
markdown = re.sub(r'<[^>]+>', '', markdown)
markdown = re.sub(r'\n.*\| Q\d 20\d{2} Form 10-[QK] \| \d+', '', markdown)
markdown.strip()

#See one of the fillings after regex:
#print(markdown)