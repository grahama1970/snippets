"""
Main entry point for the fetch-page library.

This module provides a developer-friendly interface to the fetch-page functionality.
It includes functions for extracting content from web pages and querying stored pages.
"""

import asyncio
import json
from typing import Dict, Any, Optional, Union, List, cast

import aiohttp
from loguru import logger

from fetch_page.extraction.web_page_extractor import process_page
from fetch_page.db.arangodb_utils import (
    store_page_content,
    generate_page_key,
    get_db,
)
from fetch_page.utils.conversion_utils import convert_to_markdown
from fetch_page.models import ExtractionResult


async def fetch_content(url: str) -> str:
    """
    Fetch content from a URL.
    
    Args:
        url: The URL to fetch content from
        
    Returns:
        The HTML content as a string
    """
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.text()


async def extract_page(url: str) -> ExtractionResult:
    """
    Extract content from a webpage.
    
    Args:
        url: The URL of the webpage to extract
        
    Returns:
        An ExtractionResult object containing the extracted content
    """
    content = await fetch_content(url)
    return await process_page(url, content)


async def extract_and_store(url: str, db_url: str = "http://localhost:8529", db_name: str = "mydb") -> str:
    """
    Extract content from a webpage and store it in ArangoDB.
    
    Args:
        url: The URL of the webpage to extract
        db_url: The URL of the ArangoDB server
        db_name: The name of the database
        
    Returns:
        The key of the stored page
    """
    try:
        extraction_result = await extract_page(url)
        
        # Use asyncio.to_thread for the synchronous get_db call
        db = await asyncio.to_thread(get_db, db_url, db_name)
        
        # Store the page content
        await store_page_content(db, extraction_result)
        
        # Generate and return the page key
        return generate_page_key(url)
    except Exception as e:
        logger.error(f"Error extracting and storing page: {e}")
        raise


async def query_page(url_or_key: str, output_format: str = "json", db_url: str = "http://localhost:8529", db_name: str = "mydb") -> Union[Dict[str, Any], str]:
    """
    Query a page from ArangoDB by URL or key.
    
    Args:
        url_or_key: The URL or key of the page to retrieve
        output_format: The output format (json or markdown)
        db_url: The URL of the ArangoDB server
        db_name: The name of the database
        
    Returns:
        The page content as a dictionary (if output_format is "json") or as a string (if output_format is "markdown")
    """
    try:
        # Connect to the database using asyncio.to_thread
        db = await asyncio.to_thread(get_db, db_url, db_name)
        
        # Determine if the input is a URL or a key
        if url_or_key.startswith(("http://", "https://", "about:")):
            # It's a URL, generate the key
            key = generate_page_key(url_or_key)
        else:
            # It's already a key
            key = url_or_key
        
        # Get the page from the database using asyncio.to_thread
        collection = db.collection("pages")
        doc = await asyncio.to_thread(collection.get, key)
        
        if doc is None:
            raise ValueError(f"Page with key {key} not found in the database")
        
        # Convert to a regular dictionary
        doc_dict: Dict[str, Any] = {}
        if isinstance(doc, dict):
            doc_dict = doc
        elif hasattr(doc, 'to_dict'):
            # Use to_dict method if available
            doc_dict = doc.to_dict()
        elif hasattr(doc, '__dict__'):
            # Use __dict__ if available
            doc_dict = doc.__dict__
        else:
            # Last resort, try to convert to dict directly
            doc_dict = dict(doc)
        
        # Return in the requested format
        if output_format == "json":
            return doc_dict
        else:
            return convert_to_markdown(doc_dict)
    except Exception as e:
        logger.error(f"Error querying page: {e}")
        raise


def run_extract_and_store(url: str, db_url: str = "http://localhost:8529", db_name: str = "mydb") -> str:
    """
    Run extract_and_store in a synchronous context.
    
    Args:
        url: The URL of the webpage to extract
        db_url: The URL of the ArangoDB server
        db_name: The name of the database
        
    Returns:
        The key of the stored page
    """
    try:
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(extract_and_store(url, db_url, db_name))
    except Exception as e:
        logger.error(f"Error in run_extract_and_store: {e}")
        raise


def run_query_page(url_or_key: str, output_format: str = "json", db_url: str = "http://localhost:8529", db_name: str = "mydb") -> Union[Dict[str, Any], str]:
    """
    Run query_page in a synchronous context.
    
    Args:
        url_or_key: The URL or key of the page to retrieve
        output_format: The output format (json or markdown)
        db_url: The URL of the ArangoDB server
        db_name: The name of the database
        
    Returns:
        The page content as a dictionary (if output_format is "json") or as a string (if output_format is "markdown")
    """
    try:
        loop = asyncio.get_event_loop()
        return loop.run_until_complete(query_page(url_or_key, output_format, db_url, db_name))
    except Exception as e:
        logger.error(f"Error in run_query_page: {e}")
        raise


if __name__ == "__main__":
    # Example usage
    import sys
    import argparse
    
    parser = argparse.ArgumentParser(description="Fetch Page - Extract and query webpage content")
    parser.add_argument("url", help="URL of the webpage to extract")
    parser.add_argument("--output", choices=["json", "markdown"], default="json", 
                        help="Output format (json or markdown)")
    
    args = parser.parse_args()
    
    try:
        key = run_extract_and_store(args.url)
        print(f"Extracted and stored page with key: {key}")
        
        # Query the page
        result = run_query_page(key, args.output)
        
        if args.output == "json":
            # Convert to JSON string and then take first 200 chars
            result_json = json.dumps(result, indent=2)
            print(f"Retrieved page: {result_json[:200]}...")  # Print first 200 chars
        else:
            # Result is already a string for markdown
            # Slice the string, not a dictionary
            result_str = str(result)
            print(f"Retrieved page (markdown):\n{result_str[:200]}...")  # Print first 200 chars
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1) 