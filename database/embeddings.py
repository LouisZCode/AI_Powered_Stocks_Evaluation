import gc
import time
import threading
from langchain_huggingface import HuggingFaceEmbeddings

_model = None
_last_used = 0
_unload_timer = None
_lock = threading.Lock()

IDLE_TIMEOUT = 300  # 5 minutes


def _check_and_unload():
    global _model, _unload_timer
    with _lock:
        if _model is not None and time.time() - _last_used >= IDLE_TIMEOUT:
            _model = None
            _unload_timer = None
            gc.collect()


def _get_model():
    global _model, _last_used, _unload_timer
    with _lock:
        if _model is None:
            _model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        _last_used = time.time()
        if _unload_timer is not None:
            _unload_timer.cancel()
        _unload_timer = threading.Timer(IDLE_TIMEOUT, _check_and_unload)
        _unload_timer.daemon = True
        _unload_timer.start()
        return _model


# to search inside the database with already saved data:
def embed_query(query):
    return _get_model().embed_query(query)


# the one to ingest chunks to the database:
def embed_chunks(chunks):
    return _get_model().embed_documents(chunks)

#  python -c "from database.embeddings import embed_query; v = embed_query('test'); print(f'Vector length: {len(v)}')"
