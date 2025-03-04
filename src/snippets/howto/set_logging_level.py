"""
The key is that logger.remove() removes ALL handlers across ALL modules using Loguru, and then logger.add() sets up a new handler with the desired level. This ensures consistent logging behavior across the entire application.
I apologize for my earlier incomplete understanding. This should properly suppress the DEBUG logs while allowing INFO and above to be displayed.
"""

from loguru import logger
import sys
# logger.add("logs/text_toolz.log")
logger.remove()
logger.add(sys.stderr, level="INFO")