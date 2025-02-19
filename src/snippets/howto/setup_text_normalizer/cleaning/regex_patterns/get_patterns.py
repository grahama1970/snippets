from typing import Dict, List, Optional
import regex as re

# Cache for compiled regex patterns
_cache = {}

# Base regex patterns used throughout the module
_base_patterns = {
    'toc_num': '[0-9A-Z]{1,2}(?:\\.[0-9A-Z-a-z]{0,3}){1,}',  # Table of contents numbering
    'chars': '[^ \\t\\.]',  # Any non-space/tab/period character
    'words': '[0-9A-Z-a-z(][^ \\t\\.]*',  # Words starting with alphanumeric or parenthesis
    'space': '[ \\t\\u202c\\u202d]',  # Spaces, tabs and directional formatting chars
    'title_words': '[0-9A-Z-a-z][^ \\t\\.]*(?:[ \\t\\u202c\\u202d]+[0-9A-Z-a-z(][^ \\t\\.]*){0,}'  # Title text
}

def _compile_pattern(pattern: str, flags=0) -> re.Pattern:
    """
    Compile a regex pattern with caching to improve performance.
    
    Args:
        pattern: The regex pattern string to compile
        flags: Optional regex flags
        
    Returns:
        Compiled regex pattern object
    """
    cache_key = (pattern, flags)
    if cache_key not in _cache:
        _cache[cache_key] = re.compile(pattern, flags)
    return _cache[cache_key]

def get_base_patterns() -> Dict[str, str]:
    """Get the dictionary of base regex patterns."""
    return _base_patterns

def get_patterns(additional_patterns: Optional[Dict[str, List[str]]]=None) -> Dict[str, List[re.Pattern]]:
    """
    Get dictionary of compiled regex patterns, optionally adding custom patterns.
    
    Args:
        additional_patterns: Optional dict of pattern name to list of pattern strings
        
    Returns:
        Dict mapping pattern names to lists of compiled regex patterns
    """
    # Get base pattern strings
    toc_num = _base_patterns['toc_num']
    char = _base_patterns['chars'] 
    word = _base_patterns['words']
    space = _base_patterns['space']
    title_words = _base_patterns['title_words']

    # Default patterns used by the text normalizer
    default_patterns = {
        "section_titles": [
            # Section title with TOC number and title
            _compile_pattern(
                f"^{space}*(?P<toc_num>{toc_num}){space}+(?P<title>{word}({space}+{word}|\\([^)]*\\))*)\\.?{space}*$",
                re.MULTILINE,
            ),
            # Simpler section title format
            _compile_pattern(
                f"^{space}*(?P<toc_num>{toc_num}){space}+(?P<title>{title_words})\\.?{space}*$",
                re.MULTILINE,
            ),
            # Section title with additional text
            _compile_pattern(
                f"^{space}*(?P<toc_num>{toc_num}){space}+(?P<title>{title_words})\\.?{space}+(?P<text>.+)$",
                re.MULTILINE,
            ),
            # Section title with optional parenthetical
            _compile_pattern(
                f"^{space}*(?P<toc_num>{toc_num})({space}+)?(?P<title>{word}(?:{space}*\\([^)]+\\))?(?:{space}+{word})*)\\.?{space}*$",
                re.MULTILINE,
            ),
        ],
        "bracketed_terms": [
            _compile_pattern("\\[([^\\[\\]]+)\\]"),  # Square brackets
            _compile_pattern("\\{([^\\{\\}]+)\\}"),  # Curly brackets
        ],
        "footnotes": [
            # Match footnotes not inside reference tags
            _compile_pattern(
                "(?<!<reference[^>]*>)(\\[([^\\]]+)\\]|\\(([^()]+)\\))(?![^<]*</reference>)"
            )
        ],
        "image_paths": [
            # HTTP/HTTPS URLs ending in image extensions
            _compile_pattern(
                "(?<!<image[^>]*>)(?P<image>https?://[^\\s]+\\.(jpg|jpeg|png|gif|bmp|svg))(?![^<]*</image>)"
            ),
            # Absolute paths
            _compile_pattern(
                "(?<!<image[^>]*>)(?P<image>/(?:[\\w.-]+/)*[\\w.-]+\\.(jpg|jpeg|png|gif|bmp|svg))(?![^<]*</image>)"
            ),
            # Relative paths
            _compile_pattern(
                "(?<!<image[^>]*>)(?P<image>(?:\\.{0,2}/)?(?:[\\w.-]+/)*[\\w.-]+\\.(jpg|jpeg|png|gif|bmp|svg))(?![^<]*</image>)"
            ),
            # File URLs
            _compile_pattern(
                "(?<!<image[^>]*>)(?P<image>file:///(?:[\\w.-]+/)*[\\w.-]+\\.(jpg|jpeg|png|gif|bmp|svg))(?![^<]*</image>)"
            ),
        ],
        "multiline_csv": [
            # Multiple lines with commas
            _compile_pattern(
                "(?<!<table[^>]*>)^((?:[^\\n]+,){2,}[^\\n]+(?:\\n(?:[^\\n]+,){2,}[^\\n]+)+)(?![^<]*</table>)",
                re.MULTILINE,
            ),
            # Multiple lines
            _compile_pattern("(?<!<table[^>]*>)^(.*(?:\\n.*)+)", re.MULTILINE),
        ],
        "headings": [
            _compile_pattern("^#{1,6}\\s+.*"),  # Markdown headings
            _compile_pattern("<h[1-6]>.*<\\/h[1-6]>"),  # HTML headings
        ],
        "lists": [
            _compile_pattern(
                "^(\\d+\\.\\s+|\\-\\s+|\\*\\s+).*"
            )  # Numbered and bullet lists
        ],
        "list_groups": [
            _compile_pattern(
                "^\\s*(\\d+\\.\\s+|\\-\\s+|\\*\\s+)(.*(?:\\n\\s*\\1.*)+)", re.MULTILINE
            )
        ],
        "uppercase_titles": [_compile_pattern("^[A-Z\\s]{3,}.*")],  # All caps titles
        "keyword_sections": [
            _compile_pattern("\\bIntroduction\\b", re.IGNORECASE),
            _compile_pattern("\\bConclusion\\b", re.IGNORECASE),
            _compile_pattern("\\bSummary\\b", re.IGNORECASE),
            _compile_pattern("\\bReferences\\b", re.IGNORECASE),
        ],
        "table_of_contents": [
            # TOC entries with page numbers
            _compile_pattern(
                f"""
                    ^{space}*     # Start of the string
                    \\d+(\\.\\d+)*           # Matches the numbering at the start (e.g., 3, 3.1, 3.1.1, etc.)
                    \\s+                   # Matches the space(s) after the number
                    .*                    # Matches the section title text (any characters)
                    [.\\s]+                # Matches dots (.) or spaces following the title (often TOC padding)
                    \\d+                   # Matches one or more digits (typically the page number)
                    {space}*$     # Optional spaces or tabs at the end
            """,
                re.VERBOSE,
            )
        ],
        "chapter_part_titles": [
            _compile_pattern("^\\s*(Chapter|Part|Section)\\s+\\d+", re.IGNORECASE)
        ],
        "dates_as_headers": [
            _compile_pattern("^\\s*\\d{1,2}\\s+\\w+\\s+\\d{4}")  # Date at start of line
        ],
        "dash_delimited_sections": [
            _compile_pattern("^\\s*-{3,}\\s*|\\s*—{2,}\\s*")  # Section dividers
        ],
        "indented_paragraphs": [_compile_pattern("^\\s{4,}.*")],  # Indented text
        "block_quotes": [_compile_pattern("^\\s*>.*")],  # Markdown blockquotes
        "table_titles": [
            # Various table/figure/etc title formats
            _compile_pattern(
                f"""
                ^{space}*           # Start of the line
                (                           # Capturing group for table-like titles
                    table|tbl\\.?|          # Table, Tbl, Tbl.
                    figure|fig\\.?|         # Figure, Fig, Fig.
                    exhibit|ex\\.?|         # Exhibit, Ex, Ex.
                    chart|cht\\.?|          # Chart, Cht, Cht.
                    graph|gr\\.?|           # Graph, Gr, Gr.
                    diagram|diag\\.?|       # Diagram, Diag, Diag.
                    list|lst\\.?|           # List, Lst, Lst.
                    image|img\\.?|          # Image, Img, Img.
                    illustration|illus\\.?  # Illustration, Illus, Illus.
                )
                \\s*                         # Optional whitespace
                (\\d+(?:\\.\\d+)*|\\w)          # Numbering (captured)
                \\s*                         # Optional whitespace
                ([:.-]?)                    # Optional separator (captured)
                \\s*                         # Optional whitespace
                (.*)                        # Rest of the title (captured)
                $                           # End of the line
            """,
                re.VERBOSE | re.IGNORECASE,
            )
        ],
        "table_text": [
            # Table-like text with columns
            _compile_pattern(
                """
                ^                        # Start of a line
                (?:                      # Non-capturing group to match the whole line
                    [^\\S\\r\\n]*           # Match any leading whitespace (not a newline or carriage return)
                    \\S+                  # Match one or more non-whitespace characters (a table cell)
                    [^\\S\\r\\n]+           # Match one or more whitespace characters (spaces or tabs) separating columns
                )+                       # Repeat the above group to match multiple columns
                \\S+                      # Match the final column (non-whitespace characters)
                [^\\S\\r\\n]*               # Match any trailing whitespace
                $                        # End of the line
            """,
                re.VERBOSE | re.MULTILINE,
            )
        ],
        "dates": [
            # Various date formats
            _compile_pattern(
                "\\b(?:\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|\\d{4}[/-]\\d{1,2}[/-]\\d{1,2})\\b"
            ),
            _compile_pattern("\\b(?:\\d{1,2}(?:th|st|nd|rd)?\\s+\\w+\\s+\\d{4})\\b"),
        ],
        "urls": [
            # HTTP/HTTPS URLs
            _compile_pattern(
                "https?://(?:www\\.)?[a-zA-Z0-9./?=_-]+(?:\\.[a-zA-Z]{2,})?"
            ),
            # WWW URLs
            _compile_pattern("\\b(?:www\\.)[a-zA-Z0-9./?=_-]+(?:\\.[a-zA-Z]{2,})?\\b"),
        ],
        "emails": [
            _compile_pattern("\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,7}\\b")
        ],
        "numbers": [
            _compile_pattern(
                "\\b\\d+(?:,\\d{3})*(?:\\.\\d+)?\\b"
            )  # Numbers with optional decimals/commas
        ],
        "emoji": [_compile_pattern("[\\U0001F600-\\U0001F64F]")],  # Emoji characters
        "scientific_notation": [
            _compile_pattern(r"\b([-+]?[0-9]*\.?[0-9]+)[eE]([-+]?[0-9]+)\b")
        ],
    }

    # Add any additional patterns provided
    if additional_patterns:
        for pattern_type, patterns in additional_patterns.items():
            compiled_patterns = [_compile_pattern(pattern) for pattern in patterns]
            if pattern_type in default_patterns:
                default_patterns[pattern_type].extend(compiled_patterns)
            else:
                default_patterns[pattern_type] = compiled_patterns

    return default_patterns
