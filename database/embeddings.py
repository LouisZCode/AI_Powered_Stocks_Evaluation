from langchain_huggingface import HuggingFaceEmbeddings

model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

#to search inside the database with already saved data:
def embed_query(query):
    return model.embed_query(query)


#the one to ingest chunks to the database:
def embed_chunks(chunks):
    return model.embed_documents(chunks)

#  python -c "from database.embeddings import embed_query; v = embed_query('test'); print(f'Vector length: {len(v)}')"