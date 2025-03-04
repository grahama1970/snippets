import os
import sys
import multiprocessing
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Dict, List

from arango import ArangoClient
from loguru import logger
from tqdm import tqdm

from smolagent.embedding.embedding_utils import (
    create_embedding_sync,
    init_worker,  # We'll modify this to remove console sink in child
)
from smolagent.database.initialize_database import initialize_database
from smolagent.search.query_processor import fetch_glossary_terms

# -----------------------
# 1) Configure Loguru
# -----------------------
logger.remove()  # remove the default sink

# File sink: keep logs for all processes
file_sink_id = logger.add("embedding_process.log", rotation="1 MB", enqueue=True)

# Console sink: only in main process (we may remove it in child init)
console_sink_id = logger.add(sys.stdout, colorize=True, level="INFO", enqueue=True)


def get_filtered_count(db, collection_name: str, filter_field: str) -> int:
    """Count docs missing embeddings in `collection_name`."""
    aql_query = f"""
    RETURN COUNT(
        FOR doc IN {collection_name}
        FILTER doc.{filter_field} == null OR NOT HAS(doc, '{filter_field}')
        RETURN doc
    )
    """
    try:
        cursor = db.aql.execute(aql_query)
        return next(cursor)
    except Exception as e:
        logger.error(f"Failed counting docs without {filter_field}: {e}")
        raise


def fetch_documents_with_streaming(
    db, collection_name: str, batch_size: int = 100
) -> List[Dict]:
    """Fetch docs from Arango with streaming."""
    aql_query = f"""
    FOR doc IN {collection_name}
    RETURN doc
    """
    try:
        cursor = db.aql.execute(aql_query, stream=True, batch_size=batch_size)
        return list(cursor)
    except Exception as e:
        logger.error(f"Failed fetching docs from {collection_name}: {e}")
        raise


def process_one_future(future, collection):
    """
    Obtain the embedding from a future and update the doc in Arango.
    Raise/log if something went wrong.
    """
    result = future.result()
    collection.update(
        {
            "_key": result["doc_key"],
            "embedding": result["embedding"],
            "embedding_metadata": result["metadata"],
        }
    )


def find_missing_embeddings(db, collection_name: str, batch_size: int = 100) -> None:
    """Check for docs missing embeddings."""
    total_count = db.collection(collection_name).count()
    missing_cursor = db.aql.execute(
        """
        FOR doc IN @@coll
        FILTER doc.embedding == null OR NOT HAS(doc, 'embedding')
        RETURN doc
        """,
        stream=True,
        batch_size=batch_size,
        bind_vars={"@coll": collection_name},
    )
    missing_docs = list(missing_cursor)
    if missing_docs:
        logger.warning(
            f"{len(missing_docs)} docs still missing embeddings in '{collection_name}'."
        )
        for doc in missing_docs:
            logger.warning(f"Doc with _key={doc['_key']} missing embedding.")
    else:
        logger.info(
            f"All {total_count} docs in '{collection_name}' now have embeddings."
        )


def _tag_glossary_terms_in_text(text: str, glossary_terms: List[str]) -> str:
    """Case-insensitive term tagging."""
    case_mapping = {t.lower(): t for t in glossary_terms}
    words = text.split()
    return " ".join(
        f"[TERM: {case_mapping.get(w.lower(), w)}]" if w.lower() in case_mapping else w
        for w in words
    )


def prepare_text_for_embedding(
    doc: Dict, fields: List[str], coll_name: str, config: Dict
) -> str:
    """Prepare doc text for embedding (field tagging + glossary)."""
    c_config = next(c for c in config["collections"] if c["name"] == coll_name)
    field_tags = c_config.get("field_tags", {})
    if not field_tags:
        raise ValueError(f"Collection '{coll_name}' has no field_tags in config!")

    # Simple tagging
    base_text = " ".join(
        f"{field_tags.get(f, '')} {doc[f]}" for f in fields if f in doc
    )

    # If not the glossary, also do glossary term tagging
    if coll_name != "microsoft_glossary":
        try:
            db = initialize_database(config)
            glossary_terms = fetch_glossary_terms(db)
            for f in fields:
                if f in doc:
                    doc[f] = _tag_glossary_terms_in_text(str(doc[f]), glossary_terms)
            # Rebuild with glossary tags inserted
            base_text = " ".join(
                f"{field_tags.get(f, '')} {doc[f]}" for f in fields if f in doc
            )
        except Exception as e:
            logger.error(f"Failed to tag glossary terms: {e}")

    return base_text.strip()


#
# 2) Modify init_worker so each child process doesn't spam console logs
#    We'll remove the console sink inside the child, so they only log to file.
#
def quiet_init_worker(model_name, model_dir, tqdm_lock):
    # Remove console sink in child processes
    # so logs about "Model loaded" go ONLY to file_sink
    logger.remove(console_sink_id)

    # Then call the original init_worker
    init_worker(model_name, model_dir, tqdm_lock)


def embed_collections(config: Dict):
    """Embed docs from multiple collections in parallel."""
    if not config:
        raise ValueError("No config provided.")
    db = initialize_database(config)

    # Manager for a lock to protect tqdm updates
    mgr = multiprocessing.Manager()
    tqdm_lock = mgr.Lock()

    batch_size = config["parallel_config"].get("batch_size", 100)
    max_workers = config["parallel_config"].get("max_workers", os.cpu_count() or 4)
    force_reembed = config["embedder_config"].get("force_reembed", False)

    for c_def in config["collections"]:
        c_name = c_def["name"]
        c_fields = c_def["fields"]
        coll = db.collection(c_name)

        total_count = (
            coll.count()
            if force_reembed
            else get_filtered_count(db, c_name, "embedding")
        )

        # Get relevant docs
        try:
            docs = fetch_documents_with_streaming(db, c_name, batch_size)
        except Exception as e:
            logger.error(f"Failed to fetch from {c_name}: {e}")
            continue

        # Filter out docs that already have an embedding (unless force_reembed)
        if not force_reembed:
            docs = [d for d in docs if d.get("embedding") is None]

        # TQDM bar
        with tqdm(total=total_count, desc=f"Processing {c_name}", position=0) as pbar:
            # We'll submit all tasks then update pbar AS they complete
            with ProcessPoolExecutor(
                max_workers=max_workers,
                initializer=quiet_init_worker,  # <--- Our custom init
                initargs=(
                    config["embedder_config"]["model_name"],
                    config["embedder_config"]["model_dir"],
                    tqdm_lock,
                ),
            ) as executor:
                futures_map = {}

                for doc in docs:
                    text = prepare_text_for_embedding(doc, c_fields, c_name, config)

                    # Return "doc_key" in the result so we know who to update
                    f = executor.submit(
                        _embed_one_doc,  # We'll define helper below
                        text,
                        doc["_key"],
                        config["embedder_config"],
                    )
                    futures_map[f] = doc["_key"]

                #
                # as_completed() yields futures one by one as they finish
                #
                for future in as_completed(futures_map):
                    try:
                        process_one_future(future, coll)
                    except Exception as e:
                        failed_key = futures_map[future]
                        logger.error(f"Embedding failed for doc_key={failed_key}: {e}")
                    # TQDM increments by 1 doc
                    with tqdm_lock:
                        pbar.update(1)

    logger.info("All collections processed. Checking for missing embeddings now...")

    # Post-check each collection
    for c_def in config["collections"]:
        find_missing_embeddings(db, c_def["name"], batch_size)


def _embed_one_doc(text, doc_key, embedder_config):
    """
    Helper for each doc: creates the embedding, returns a dict containing doc_key + embedding data.
    This is the function each worker calls. We keep it small and simple.
    """
    result = create_embedding_sync(text, embedder_config)
    # Include doc_key so the parent process knows which doc to update
    result["doc_key"] = doc_key
    return result


def main():
    config = {
        "db": {
            "hosts": "http://localhost:8529",
            "name": "verifaix",
            "username": "root",
            "password": "openSesame",
        },
        "collections": [
            {
                "name": "microsoft_glossary",
                "fields": ["term", "definition"],
                "field_tags": {"term": "[TERM]", "definition": "[DEFINITION]"},
            },
            {
                "name": "microsoft_issues",
                "fields": ["issue_type", "description"],
                "field_tags": {"issue_type": "[ISSUE]", "description": "[DESCRIPTION]"},
            },
            {
                "name": "microsoft_products",
                "fields": ["category", "name", "description", "sentiment"],
                "field_tags": {
                    "category": "[CATEGORY]",
                    "name": "[PRODUCT]",
                    "description": "[DESCRIPTION]",
                    "sentiment": "[SENTIMENT]",
                },
            },
            {
                "name": "microsoft_support",
                "fields": ["category", "content", "sentiment"],
                "field_tags": {
                    "category": "[CATEGORY]",
                    "content": "[CONTENT]",
                    "sentiment": "[SENTIMENT]",
                },
            },
        ],
        "embedder_config": {
            "model_name": "nomic-ai/modernbert-embed-base",
            "model_dir": "./models/huggingface/",
            "force_reembed": True,  # For quicker testing, set False
            "tag_document_terms": True, # For ModernBert
        },
        "parallel_config": {"batch_size": 100, "max_workers": os.cpu_count() or 4},
    }
    embed_collections(config)


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
