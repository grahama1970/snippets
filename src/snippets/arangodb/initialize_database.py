from arango import ArangoClient
from arango.exceptions import ArangoError, ServerConnectionError
from loguru import logger
from typing import Dict, Any


def initialize_database(config: Dict[str, Any]):
    """
    Sets up and connects to the ArangoDB client, ensuring the database is created if it doesn't exist.

    Args:
        config (dict): Either a standalone `arango_config` dictionary or a larger `config` dictionary
                    containing `arango_config` as a nested field.

    Returns:
        db: The connected ArangoDB database instance or None if an error occurs.
    """
    try:
        # Handle both standalone `arango_config` and nested `arango_config` cases
        if "arango_config" in config:
            arango_config = config["arango_config"]
        else:
            arango_config = config

        # Extract configuration values with defaults
        arango_config = config.get("arango_config", {})
        hosts = arango_config.get("hosts", ["http://localhost:8529"])
        db_name = arango_config.get("db_name", "verifaix")
        username = arango_config.get("username", "root")
        password = arango_config.get("password", "openSesame")

        # Initialize the ArangoDB client
        client = ArangoClient(hosts=hosts)

        # Connect to the database
        db = client.db(db_name, username=username, password=password)
        # logger.success(f"Connected to database '{db_name}'.")
        return db

    except ArangoError as e:
        logger.error(f"ArangoDB error: {e}")
        return None
    except ServerConnectionError as e:
        logger.error(f"Failed to connect to ArangoDB server: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return None


if __name__ == "__main__":
    config = {
        "arango_config": {
            "hosts": ["http://localhost:8529"],
            "db_name": "verifaix",
            "username": "root",
            "password": "openSesame",
        }
    }
    db = initialize_database(config)
    print(db)
