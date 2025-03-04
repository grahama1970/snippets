import litellm
import os
import redis
from loguru import logger
from summarizer.utils.file_utils import load_env_file

load_env_file()


def initialize_litellm_cache():
    try:
        # Test Redis connection before enabling caching
        test_redis = redis.Redis(
            host="localhost",
            port=6379,
            password=None,
            socket_timeout=2
        )
        if not test_redis.ping():
            raise ConnectionError("Redis is not responding.")

        litellm.cache = litellm.Cache(
            type="redis",
            host="localhost",  # Redis host
            port=6379,  # Redis port
            password=None,  # Password if set, otherwise None
        )
        litellm.enable_cache()
        os.environ["LITELLM_LOG"] = "DEBUG"
        logger.info("✅ Redis caching enabled on localhost:6379")

    except (redis.ConnectionError, redis.TimeoutError) as e:
        logger.warning(
            f"⚠️ Redis connection failed: {e}. Falling back to in-memory caching."
        )
        # Fall back to in-memory caching if Redis is unavailable
        litellm.cache = litellm.Cache(type="local")
        litellm.enable_cache()
