from typing import Dict, List, Union
import regex as re
from src.snippets.howto.setup_text_normalizer.cleaning.regex_patterns.get_patterns import _compile_pattern


def get_replacements() -> Dict[str, Union[Dict[str, str], List[re.Pattern]]]:
    """Returns the default string replacements.

    Returns:
        Dict mapping replacement categories to either:
        - Dict[str, str]: Pattern to replacement string mappings
        - List[Pattern]: List of regex patterns to remove matches
    """
    return {
        "scientific_notation": {
            r"\b([-+]?[0-9]*\.?[0-9]+)[eE]([-+]?[0-9]+)\b": r"\1×10^\2"
        },
        "unicode_replacements": {
            "°": " degrees ",
            "§": " section ",
            "−": "-",
            "‐": "-",
            "‑": "-",
            "‒": "-",
            "–": "-",
            "—": "-",
            "―": "-",
            """: "'",
            """: "'",
            "‚": "'",
            "‛": "'",
            '"': '"',
            '"': '"',
            "„": '"',
            "‟": '"',
            "…": "...",
            "\x92": "'",
            "\x93": '"',
            "\x94": '"',
            "•": "*",
            "™": "(TM)",
            "©": "(C)",
            "®": "(R)",
            "€": "EUR",
            "†": "†",
            "‡": "‡",
            "\x00": "",
            "\u202c": "",
            "\u202d": "",
            "\u202e": "",
            "\u200e": "",
            "\u200f": "",
            "\u200d": "",
            "\u2060": "",
            "\ufeff": "",
            "\u200b": "",
        },
        "bullet_point_replacements": {
            "•": "-",
            "○": "-",
            "▪": "-",
            "▫": "-",
            "✓": "-",
            "✔": "-",
            "✗": "-",
            "✘": "-",
            "□": "-",
            "■": "-",
            "▲": "-",
            "△": "-",
            "▶": "-",
            "▷": "-",
            "◆": "-",
            "◇": "-",
            "●": "-",
            "◉": "-",
            "◎": "-",
            "○": "-",
            "◍": "-",
            "◌": "-",
        },
        "latex_replacements": {
            "\\\\alpha": "α",
            "\\\\beta": "β",
            "\\\\gamma": "γ",
            "\\\\delta": "δ",
            "\\\\epsilon": "ε",
            "\\\\zeta": "ζ",
            "\\\\eta": "η",
            "\\\\theta": "θ",
            "\\\\iota": "ι",
            "\\\\kappa": "κ",
            "\\\\lambda": "λ",
            "\\\\mu": "μ",
            "\\\\nu": "ν",
            "\\\\xi": "ξ",
            "\\\\omicron": "ο",
            "\\\\pi": "π",
            "\\\\rho": "ρ",
            "\\\\sigma": "σ",
            "\\\\tau": "τ",
            "\\\\upsilon": "υ",
            "\\\\phi": "φ",
            "\\\\chi": "χ",
            "\\\\psi": "ψ",
            "\\\\omega": "ω",
            "\\\\Gamma": "Γ",
            "\\\\Delta": "Δ",
            "\\\\Theta": "Θ",
            "\\\\Lambda": "Λ",
            "\\\\Xi": "Ξ",
            "\\\\Pi": "Π",
            "\\\\Sigma": "Σ",
            "\\\\Upsilon": "Υ",
            "\\\\Phi": "Φ",
            "\\\\Psi": "Ψ",
            "\\\\Omega": "Ω",
            "\\\\infty": "∞",
            "\\\\nabla": "∇",
            "\\\\partial": "∂",
            "\\\\sum": "∑",
            "\\\\prod": "∏",
            "\\\\int": "∫",
            "\\\\sqrt": "√",
            "\\\\frac": "<frac>",
            "\\\\dfrac": "<dfrac>",
            "\\\\textit": "<i>",
            "\\\\textbf": "<b>",
            "\\\\texttt": "<tt>",
            "\\\\textrm": '<span style="font-family: serif;">',
            "\\\\textsf": '<span style="font-family: sans-serif;">',
        },
        "standardize_punctuation": {"—": "-", "–": "-"},
        "special_characters_removal": [_compile_pattern('â€™|â€œ|â€|â€–|â€"|â€—')],
        "contractions": {
            "ain't": "am not",
            "aren't": "are not",
            "can't": "cannot",
            "can't've": "cannot have",
            "'cause": "because",
            "could've": "could have",
            "couldn't": "could not",
            "couldn't've": "could not have",
            "didn't": "did not",
            "doesn't": "does not",
            "don't": "do not",
            "hadn't": "had not",
            "hadn't've": "had not have",
            "hasn't": "has not",
            "haven't": "have not",
            "he'd": "he would",
            "he'd've": "he would have",
            "he'll": "he will",
            "he'll've": "he will have",
            "he's": "he is",
            "how'd": "how did",
            "how'd'y": "how do you",
            "how'll": "how will",
            "how's": "how is",
            "i'd": "I would",
            "i'd've": "I would have",
            "i'll": "I will",
            "i'll've": "I will have",
            "i'm": "I am",
            "i've": "I have",
            "isn't": "is not",
            "it'd": "it would",
            "it'd've": "it would have",
            "it'll": "it will",
            "it'll've": "it will have",
            "it's": "it is",
            "let's": "let us",
            "ma'am": "madam",
            "mayn't": "may not",
            "might've": "might have",
            "mightn't": "might not",
            "mightn't've": "might not have",
            "must've": "must have",
            "mustn't": "must not",
            "mustn't've": "must not have",
            "needn't": "need not",
            "needn't've": "need not have",
            "o'clock": "of the clock",
            "oughtn't": "ought not",
            "oughtn't've": "ought not have",
            "shan't": "shall not",
            "sha'n't": "shall not",
            "shan't've": "shall not have",
            "she'd": "she would",
            "she'd've": "she would have",
            "she'll": "she will",
            "she'll've": "she will have",
            "she's": "she is",
            "should've": "should have",
            "shouldn't": "should not",
            "shouldn't've": "should not have",
            "so've": "so have",
            "so's": "so is",
            "that'd": "that would",
            "that'd've": "that would have",
            "that's": "that is",
            "there'd": "there would",
            "there'd've": "there would have",
            "there's": "there is",
            "they'd": "they would",
            "they'd've": "they would have",
            "they'll": "they will",
            "they'll've": "they will have",
            "they're": "they are",
            "they've": "they have",
            "to've": "to have",
            "wasn't": "was not",
            "we'd": "we would",
            "we'd've": "we would have",
            "we'll": "we will",
            "we'll've": "we will have",
            "we're": "we are",
            "we've": "we have",
            "weren't": "were not",
            "what'll": "what will",
            "what'll've": "what will have",
            "what're": "what are",
            "what's": "what is",
            "what've": "what have",
            "when's": "when is",
            "when've": "when have",
            "where'd": "where did",
            "where's": "where is",
            "where've": "where have",
            "who'll": "who will",
            "who'll've": "who will have",
            "who's": "who is",
            "who've": "who have",
            "why's": "why is",
            "why've": "why have",
            "will've": "will have",
            "won't": "will not",
            "won't've": "will not have",
            "would've": "would have",
            "wouldn't": "would not",
            "wouldn't've": "would not have",
            "y'all": "you all",
            "y'all'd": "you all would",
            "y'all'd've": "you all would have",
            "y'all're": "you all are",
            "y'all've": "you all have",
            "you'd": "you would",
            "you'd've": "you would have",
            "you'll": "you will",
            "you'll've": "you will have",
            "you're": "you are",
            "you've": "you have",
        },
        "hyphenated_word_fix": {"(\\w+)-\\n(\\w+)": "\\1\\2"},
    }


def preserve_case_replacement(match: re.Match, replacement: str) -> str:
    """Preserves the case of the first character in the match.
    
    Args:
        match: The regex match object
        replacement: The replacement string
        
    Returns:
        The replacement string with preserved case
    """
    original = match.group(0)
    if original[0].isupper():
        return replacement.capitalize()
    return replacement


def normalize_text_with_replacements(text: str) -> str:
    """Apply all replacements from get_replacements() to the input text.

    This function applies all replacement rules to the given text, processing each category
    of replacements (unicode, bullet points, LaTeX, and contractions) in order.

    Args:
        text: The input text to process

    Returns:
        The processed text with all replacements applied
    """
    replacements = get_replacements()
    
    for category, replace_dict in replacements.items():
        if category == 'contractions':
            # Add word boundaries around contraction patterns
            replace_dict = {
                f'\\b{pattern}\\b': replacement 
                for pattern, replacement in replace_dict.items()
            }
            
        if isinstance(replace_dict, list):
            # Handle special case of removal patterns
            for pattern in replace_dict:
                text = pattern.sub('', text)
        else:
            # Apply standard replacements with case preservation
            for pattern, replacement in replace_dict.items():
                text = re.sub(
                    pattern,
                    lambda m: preserve_case_replacement(m, replacement),
                    text,
                    flags=re.IGNORECASE
                )
                
    return text


if __name__ == '__main__':
    sample_text = "There'd be a test • with some unicode ™ and LaTeX \\alpha. It ain't easy!"
    processed_text = normalize_text_with_replacements(sample_text)
    print(f'Original: {sample_text}')
    print(f'Processed: {processed_text}')
