import os
from loguru import logger

def load_aql_query(file_path: str = 'utils/aql/glosssary_search_simple.aql') -> str:
    """Load AQL query from file."""
    try:
        with open(file_path, 'r') as file:
            return file.read().strip()
    except Exception as e:
        logger.error(f"Failed to load AQL query from {file_path}: {e}")
        raise

# Add this to the config dictionary in main():
config = {
    'db': {
        'hosts': 'http://localhost:8529',
        'name': 'verifaix',
        'username': 'root',
        'password': 'openSesame'
    },
    'collections': [
        {
            'name': 'glossary',
            'fields': ['term', 'primary_definition']
        }
    ],
    'embedder_config': {
        'model_name': 'sentence-transformers/all-mpnet-base-v2',
        'model_dir': './models/huggingface/',
        'force_reembed': False
    },
    'parallel_config': {
        'batch_size': 100,
        'max_workers': os.cpu_count() or 4
    },
    'aql_queries': {
        'glossary_search': load_aql_query()  # Load the AQL query
    }
} 