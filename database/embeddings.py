import os
from langchain_openai import OpenAIEmbeddings

_model = OpenAIEmbeddings(
    model="openai/text-embedding-3-small",
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
    chunk_size=500,
    max_retries=3,
)


def embed_query(query):
    return _model.embed_query(query)


def embed_chunks(chunks):
    return _model.embed_documents(chunks)
