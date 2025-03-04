from concurrent.futures import ProcessPoolExecutor
from arango import ArangoClient
from loguru import logger
from smolagent.embedding.embedding_utils import create_embedding_sync

def process_futures(futures, collection):
    """Process a batch of futures and update the database."""
    for future, doc_key in futures:
        try:
            result = future.result()  # Blocking call to get the result
            collection.update({
                '_key': doc_key,
                'embedding': result['embedding'],
                'embedding_metadata': result['metadata']
            })
        except Exception as e:
            logger.error(f"Failed to embed document with key {doc_key}: {e}")


def find_missing_embeddings(db, collection_name='glossary', batch_size=100):
    # Get the total number of documents in the collection
    total_count = db.collection(collection_name).count()

    # Look for missing embeddings
    final_check_cursor = db.aql.execute(
        """
        FOR doc IN @@collection_name
        FILTER doc.embedding == null OR NOT HAS(doc, 'embedding')
        RETURN doc
        """,
        stream=True,  # Avoid cursor timeouts
        batch_size=batch_size,
        bind_vars={'@collection_name': collection_name}
    )

    # Count the number of documents still missing embeddings
    missing_embeddings = list(final_check_cursor)
    if missing_embeddings:
        logger.warning(f"{len(missing_embeddings)} documents are still missing embeddings.")
        for doc in missing_embeddings:
            logger.warning(f"Document with _key {doc['_key']} is missing an embedding.")
    else:
        logger.info(f"All {total_count} documents in '{collection_name}' have been successfully embedded.")


def embed_glossary_entries(db=None, batch_size=100):
    """Embed glossary entries in parallel using ProcessPoolExecutor."""
    client = ArangoClient(hosts='http://localhost:8529')
    db = db or client.db('verifaix', username='root', password='openSesame')
    collection = db.collection('glossary')
    
    # Get entries without embeddings with batching and streaming
    cursor = db.aql.execute(
        """
        FOR doc IN glossary
        FILTER doc.embedding == null OR NOT HAS(doc, 'embedding')
        RETURN doc
        """,
        stream=True,  # avoid cursor timeouts when batching
        batch_size=batch_size
    )
    
    batch_count = 0
    
    with ProcessPoolExecutor() as executor:
        futures = []
        for doc in cursor:
            text = f"{doc['term']}: {doc['primary_definition']}"
            # Submit the embedding task to the process pool
            future = executor.submit(create_embedding_sync, text)
            futures.append((future, doc['_key']))
            
            # Process a batch of futures
            if len(futures) >= batch_size:
                process_futures(futures, collection)
                futures = []  # Reset the futures list for the next batch
                batch_count += batch_size
                logger.info(f"Processed {batch_count} documents")
        
        # Process any remaining futures: strangglers
        if futures:
            process_futures(futures, collection)
            batch_count += len(futures)
            logger.info(f"Processed {batch_count} documents in total")

    logger.info("Embedding process completed. Check that all documents have embeddings.")
    find_missing_embeddings(db)


if __name__ == "__main__":
    embed_glossary_entries()