from functools import lru_cache
import os
import time
import asyncio
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModel
from typing import Dict, List, Union
from datetime import datetime, timezone
from loguru import logger
from dotenv import load_dotenv
import warnings
from sentence_transformers import SentenceTransformer

# Global variables for shared model and tokenizer
_model = None
_tokenizer = None
_sentence_transformer = None
_tqdm_lock = None

from smolagent.utils.file_utils import load_env_file
load_env_file()


# Batching and Workers
def init_worker(model_name: str, model_dir: str, progress_lock=None):
    """Initialize the worker process."""
    global _model, _tokenizer, _tqdm_lock
    _tqdm_lock = progress_lock  # Store the lock in global worker state
    _model, _tokenizer = _load_model_and_tokenizer(model_dir, model_name)


def average_pool(last_hidden_states: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
    """Apply average pooling to model outputs."""
    last_hidden = last_hidden_states.masked_fill(~attention_mask[..., None].bool(), 0.0)
    return last_hidden.sum(dim=1) / attention_mask.sum(dim=1)[..., None]


# Huggingface Embedding Model
@lru_cache(maxsize=1)
def _load_model_and_tokenizer(model_dir: str = './models/huggingface/', model_name: str = 'sentence-transformers/all-MiniLM-L6-v2'):
    """Load the BERT-based model and tokenizer for local embedding."""
    global model, tokenizer
    warnings.filterwarnings('ignore', message='`resume_download` is deprecated and will be removed in version 1.0.0')
    
    try:
        # Ensure the model directory exists
        if not os.path.exists(model_dir):
            os.makedirs(model_dir)
            logger.info(f'Created model directory at {model_dir}')
        
        # Log the model directory being used
        logger.info(f'Using model directory: {model_dir}')
        
        # Load the tokenizer and model
        start_time = time.time()
        tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir=model_dir)
        model = AutoModel.from_pretrained(model_name, cache_dir=model_dir)
        
        # Log the model files in the cache directory
        model_files = os.listdir(model_dir)
        logger.info(f'Model files in cache directory: {model_files}')
        
        # Move model to GPU if available
        if torch.cuda.is_available():
            model = model.to('cuda')
            logger.info('Using GPU for embeddings.')
        else:
            logger.info('Using CPU for embeddings.')
        
        # Log the load time
        load_time = time.time() - start_time
        logger.info(f'Model {model_name} loaded successfully in {load_time:.2f} seconds and stored in {model_dir}')
        
        return model, tokenizer
        
    except Exception as e:
        logger.error(f"Error loading model and tokenizer: {e}")
        raise


def get_model_and_tokenizer(
        model_dir: str = './models/huggingface/', 
        model_name: str = 'sentence-transformers/all-MiniLM-L6-v2'
):
    """Get or lazily initialize model and tokenizer."""
    global _model, _tokenizer
    if _model is None or _tokenizer is None:
        _model, _tokenizer = _load_model_and_tokenizer(model_dir, model_name)
    return _model, _tokenizer

async def create_embedding(text: str, embedder_config: Dict=None) -> Dict[str, Union[List[float], Dict]]:
    """Generate an embedding using a local model."""
    global model, tokenizer
    
    if embedder_config is None:
        embedder_config = {
            'location': 'local', 
            'model_name': 'sentence-transformers/all-MiniLM-L6-v2', 
            'model_dir': './models/huggingface/'
        }
    
    model_name = embedder_config.get('model_name', 'sentence-transformers/all-MiniLM-L6-v2')
    model_dir = embedder_config.get('model_dir', './models/huggingface/')
    
    # Get model and tokenizer from the function
    if model is None or tokenizer is None:
        model, tokenizer = _load_model_and_tokenizer(model_dir, model_name)
    
    encoded_input = tokenizer(text, padding=True, truncation=True, return_tensors='pt')
    if torch.cuda.is_available():
        encoded_input = {k: v.to('cuda') for (k, v) in encoded_input.items()}
    
    with torch.no_grad():
        model_output = model(**encoded_input)
        embedding = average_pool(model_output.last_hidden_state, encoded_input['attention_mask'])
        embedding = F.normalize(embedding, p=2, dim=1).cpu().tolist()[0]
    
    metadata = {
        'embedding_model': model_name, 
        'embedding_timestamp': datetime.now(timezone.utc).isoformat(), 
        'embedding_method': 'local'
    }
    return {'embedding': embedding, 'metadata': metadata}


def create_embedding_sync(text: str, embedder_config: Dict = None) -> Dict[str, Union[List[float], Dict]]:
    """Generate an embedding using a shared model."""
    if embedder_config is None:
        embedder_config = {
            'model_name': 'sentence-transformers/all-MiniLM-L6-v2',
            'model_dir': './models/huggingface/'
        }
    
    # Get model and tokenizer using the cached loader
    model, tokenizer = get_model_and_tokenizer(
        model_dir=embedder_config.get('model_dir', './models/huggingface/'),
        model_name=embedder_config.get('model_name', 'sentence-transformers/all-MiniLM-L6-v2')
    )
    
    # Encode the input text
    encoded_input = tokenizer(text, padding=True, truncation=True, return_tensors='pt')
    
    # Move inputs to GPU if available
    if torch.cuda.is_available():
        encoded_input = {k: v.to('cuda') for (k, v) in encoded_input.items()}
    
    # Generate the embedding
    with torch.no_grad():
        model_output = _model(**encoded_input)
        embedding = average_pool(model_output.last_hidden_state, encoded_input['attention_mask'])
        embedding = F.normalize(embedding, p=2, dim=1).cpu().tolist()[0]
    
    # Prepare metadata
    metadata = {
        'embedding_model': embedder_config.get('model_name', 'sentence-transformers/all-mpnet-base-v2'),
        'embedding_timestamp': datetime.now(timezone.utc).isoformat(),
        'embedding_method': 'local'
    }
    
    return {'embedding': embedding, 'metadata': metadata}


# Sentence Transformer
@lru_cache(maxsize=1)
def _load_sentence_transformer(model_name: str) -> SentenceTransformer:
    """Load the SentenceTransformer model with caching."""
    logger.info(f"Loading SentenceTransformer model: {model_name}")
    return SentenceTransformer(model_name)

def get_sentence_transformer(model_name: str) -> SentenceTransformer:
    """Get or lazily initialize the SentenceTransformer model."""
    global _sentence_transformer
    if _sentence_transformer is None:
        _sentence_transformer = _load_sentence_transformer(model_name)
    return _sentence_transformer



async def main():
    print('hello')
    _load_model_and_tokenizer()
    embedding = await create_embedding('Hello, world!')
    print(embedding)



if __name__ == '__main__':
    asyncio.run(main())
