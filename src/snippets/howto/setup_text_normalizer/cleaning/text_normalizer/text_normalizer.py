import html
import unicodedata
import warnings
from typing import Callable, Dict, List, Optional

import emoji
import regex as re
from better_profanity import profanity
from bs4 import BeautifulSoup, MarkupResemblesLocatorWarning
from dateutil.parser import parse as date_parser
from langdetect import LangDetectException, detect
from loguru import logger
from nltk import pos_tag
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize


from snippets.howto.setup_text_normalizer.cleaning.regex_patterns.get_patterns import get_patterns

from snippets.howto.setup_text_normalizer.cleaning.text_normalizer.normalize_text_with_replacements import (
    get_replacements,
)

from snippets.howto.setup_text_normalizer.cleaning.text_normalizer.text_normalizer_config import (
    TextNormalizerConfig,
    TextCleaningStep,
)

warnings.filterwarnings("ignore", category=MarkupResemblesLocatorWarning)

# Define a type for the text cleaning function
TextCleaningFunction = Callable[[str], str]
# TextCleaningFunction = Callable[[str, ...], str]

regex_replacements = get_replacements()
regex_patterns = get_patterns()


def remove_html_tags(text: str) -> str:
    logger.debug(f"Removing HTML tags. Input: '{text}'")
    if re.match("\\d{1,2}/\\d{1,2}/\\d{4}", text):
        logger.debug(f"Skipping HTML parsing for date-like or path-like text: {text}")
        return text
    soup = BeautifulSoup(text, "html.parser")
    result = soup.get_text()
    logger.debug(f"After removing HTML tags: '{result}'")
    return result


def normalize_unicode(text: str) -> str:
    logger.debug("Normalizing Unicode characters.")
    return unicodedata.normalize("NFKC", text)


def filter_profanity(text: str, custom_word_list: Optional[List[str]] = None) -> str:
    """Filter profanity from the text."""
    profanity.load_censor_words()
    if custom_word_list:
        profanity.add_censor_words(
            custom_word_list
        )  # Add custom words to the profanity filter
    logger.debug(f"Filtering profanity. Input: '{text}'")

    def custom_censor(word):
        if word == "[REMOVED]":
            return word
        match = re.match("(\\w+)(\\W*)", word)
        if match:
            base_word = match.group(1)
            punctuation = match.group(2)
            if profanity.contains_profanity(base_word):
                return base_word[0] + "*" * (len(base_word) - 1) + punctuation
        return word

    words = text.split()
    censored_words = [custom_censor(word) for word in words]
    result = " ".join(censored_words)
    logger.debug(f"After filtering profanity: '{result}'")
    return result


def remove_special_characters_old(text: str, preserve: Optional[str] = None) -> str:
    logger.debug(f"Removing special characters, preserving: {preserve}")
    if preserve is None:
        preserve = "-_'"
    special_chars_pattern = re.compile(f"[^\\w\\s{re.escape(preserve)}]", re.UNICODE)
    text = special_chars_pattern.sub("", text)
    logger.debug(f"After removing special characters (except {preserve}): '{text}'")
    return text


def remove_invalid_characters(text: str) -> str:
    logger.debug("Removing non-displayable characters.")
    invalid_chars_pattern = re.compile("[\\u0000-\\u001F\\u007F-\\u009F]+")
    cleaned_text = invalid_chars_pattern.sub("", text)
    logger.debug(f"After removing invalid characters: '{cleaned_text}'")
    return cleaned_text


def normalize_whitespace(text: str) -> str:
    logger.debug("Normalizing whitespace.")
    result = re.sub("\\s+", " ", text).rstrip()
    logger.debug(f"After normalizing whitespace: '{result}'")
    return result


def lemmatize(text: str) -> str:
    lemmatizer = WordNetLemmatizer()
    logger.debug(f"Lemmatizing text. Input: '{text}'")
    words = word_tokenize(text)
    tagged_words = pos_tag(words)
    lemmatized_words = []
    for word, tag in tagged_words:
        if word == "[REMOVED]":
            lemmatized_words.append(word)
            continue
        if tag.startswith("NN"):
            pos = "n"
        elif tag.startswith("VB"):
            pos = "v"
        elif tag.startswith("JJ"):
            pos = "a"
        elif tag.startswith("RB"):
            pos = "r"
        else:
            pos = "n"
        lemma = lemmatizer.lemmatize(word, pos=pos)
        lemmatized_words.append(lemma)
    result = " ".join(lemmatized_words)
    logger.debug(f"After lemmatization: '{result}'")
    return result


def expand_contractions(text: str) -> str:
    logger.debug("Expanding contractions.")
    contractions = regex_replacements.get("contractions", {})

    def case_preserving_replace(match):
        contraction = match.group(0)
        expansion = contractions[contraction.lower()]
        if contraction.isupper():
            return expansion.upper()
        elif contraction[0].isupper():
            return expansion.capitalize()
        else:
            return expansion.lower()

    def replace_contractions(text_part: str) -> str:
        for contraction in contractions:
            text_part = re.sub(
                f"\\b{re.escape(contraction)}\\b",
                case_preserving_replace,
                text_part,
                flags=re.IGNORECASE,
            )
        return text_part

    segments = re.split("(\\[REMOVED\\])", text)
    for i in range(len(segments)):
        if segments[i] != "[REMOVED]":
            segments[i] = replace_contractions(segments[i])
    expanded_text = "".join(segments)
    logger.debug(f"After expanding contractions: '{expanded_text}'")
    return expanded_text


def remove_duplicate_lines(text: str) -> str:
    logger.debug("Removing duplicate lines.")
    lines = text.split("\n")
    unique_lines = []
    for line in lines:
        stripped_line = line.rstrip()
        if stripped_line and stripped_line not in unique_lines:
            unique_lines.append(stripped_line)
    result = "\n".join(unique_lines)
    logger.debug(f"After removing duplicate lines: '{result}'")
    return result


def replace_unicode_and_bullet_points(text: str) -> str:
    logger.debug("Replacing unicode characters and bullet points.")
    replacements = {
        **regex_replacements["unicode_replacements"],
        **regex_replacements["bullet_point_replacements"],
    }
    pattern = re.compile(
        "^[ \\t]*(" + "|".join(map(re.escape, replacements.keys())) + ")", re.MULTILINE
    )

    def replacement_function(match):
        unicode_char = match.group(1)
        replacement = replacements.get(unicode_char, unicode_char)
        logger.debug(f"Replacing {repr(unicode_char)} with {repr(replacement)}")
        return match.group(0).replace(unicode_char, replacement)

    result = pattern.sub(replacement_function, text)
    return result


def remove_control_characters(text):
    """Helper function to remove non-visible control characters."""
    return "".join((ch for ch in text if ch.isprintable()))


def standardize_dates(text: str) -> str:
    logger.debug("Standardizing dates.")
    return re.sub(
        regex_patterns["dates"][0],
        lambda x: date_parser(x.group(0)).strftime("%Y-%m-%d"),
        text,
    )


def tokenize_urls_emails(text: str) -> str:
    logger.debug(f"Tokenizing URLs and emails. Input: '{text}'")
    trailing_punctuation = ""
    if text[-1] in ".!?":
        trailing_punctuation = text[-1]
        text = text[:-1]
    clean_text = re.sub(
        f"\\[REMOVED\\](*SKIP)(*FAIL)|{regex_patterns['url_email_tokenization'][0]}",
        lambda x: "[EMAIL]" + x.group(2) if x.group(0) != "[REMOVED]" else x.group(0),
        text,
    )
    clean_text = re.sub(
        f"\\[REMOVED\\](*SKIP)(*FAIL)|{regex_patterns['url_email_tokenization'][1]}",
        lambda x: "[URL]" + x.group(2) if x.group(0) != "[REMOVED]" else x.group(0),
        clean_text,
    )
    clean_text += trailing_punctuation
    logger.debug(f"After tokenizing URLs and emails: '{clean_text}'")
    return clean_text


def standardize_numbers(text: str) -> str:
    logger.debug("Standardizing numbers.")
    return re.sub(
        f"\\[REMOVED\\](*SKIP)(*FAIL)|{regex_patterns['numbers'][0]}",
        lambda x: (
            f"{x.group(1)}{x.group(2)}" if x.group(0) != "[REMOVED]" else x.group(0)
        ),
        text,
    )


def handle_emojis(text: str) -> str:
    logger.debug(f"Handling emojis. Input: '{text}'")

    def replace_emoji(char):
        if char == "[REMOVED]":
            return "[REMOVED]"
        if emoji.is_emoji(char):
            return f" {emoji.demojize(char)} "
        return char

    result = "".join((replace_emoji(char) for char in text))
    result = re.sub("\\s+", " ", result).rstrip()
    return result


def correct_spelling(text: str, spell_checker) -> str:
    logger.debug("Correcting spelling.")
    tokens = text.split()
    corrected_tokens = [spell_checker.correction(token) for token in tokens]
    return " ".join(corrected_tokens)


def standardize_punctuation(text: str) -> str:
    logger.debug("Standardizing punctuation.")
    replacements = regex_replacements.get("standardize_punctuation", {})
    for old, new in replacements.items():
        text = text.replace(old, new)
    return re.sub('\\s([?.!,"](?:\\s|$))', "\\1", text)


def remove_accents_and_diacritics(text: str) -> str:
    logger.debug("Removing accents and diacritics.")
    return "".join(
        (
            c
            for c in unicodedata.normalize("NFD", text)
            if unicodedata.category(c) != "Mn"
        )
    )


def normalize_math(text: str) -> str:
    logger.debug(f"Normalizing math formulas. Input: '{text}'")
    replacements = regex_replacements.get("latex_replacements", {})
    for latex, symbol in replacements.items():
        latex_pattern = latex.replace("\\\\", "\\")
        text = re.sub("(?<!\\\\)" + re.escape(latex_pattern), symbol, text)
    text = text.replace("∑", "sum")
    text = text.replace("∫", "integral")
    text = re.sub("_(\\w)", " subscript \\1", text)
    text = re.sub("\\^(\\w)", " superscript \\1", text)
    text = text.replace("$", "")
    logger.debug(f"After normalizing math: '{text}'")
    return text


def strip_leading_spaces(text: str) -> str:
    logger.debug("Stripping leading spaces from the text.")
    lines = text.split("\n")
    stripped_lines = [line.lstrip() for line in lines]
    stripped_text = "\n".join(stripped_lines)
    return stripped_text


def _handle_text_in_brackets(text: str) -> str:

    def replacer(match):
        return match.group(0).replace(" ", "⚙️").replace("\t", "⚙️")

    text = re.sub("\\[REMOVED\\](*SKIP)(*FAIL)|\\[.*?\\]|\\{.*?\\}", replacer, text)
    text = text.replace("⚙️", " ")
    return text


def detect_language(text: str) -> str:
    logger.debug("Detecting language.")
    try:
        return detect(text)
    except LangDetectException as e:
        logger.warning(f"Language detection failed: {e}")
        return "en"


def handle_scientific_notation(text: str) -> str:
    logger.debug("Handling scientific notation.")
    return re.sub(
        regex_patterns["scientific_notation"][0],
        # Now matches the replacement pattern structure
        lambda m: regex_replacements["scientific_notation"][m.re.pattern](m),
        text,
    )


def replace_html_entities(text: str) -> str:
    logger.debug("Replacing HTML entities.")
    return html.unescape(text)


def remove_directional_formatting(text: str) -> str:
    """
    Removes all Unicode directional formatting characters from the input text using regex.

    Args:
        text (str): The input string from which directional formatting characters should be removed.

    Returns:
        str: The cleaned string with directional formatting characters removed.
    """
    directional_pattern = "[\\u200E\\u200F\\u202A\\u202B\\u202C\\u202D\\u202E\\u2066\\u2067\\u2068\\u2069]"
    return re.sub(directional_pattern, "", text)


# Define the complete FUNCTION_MAP
FUNCTION_MAP: Dict[str, TextCleaningFunction] = {
    "remove_html_tags": remove_html_tags,
    "normalize_unicode": normalize_unicode,
    "filter_profanity": filter_profanity,
    "remove_special_characters": remove_invalid_characters,
    "normalize_whitespace": normalize_whitespace,
    "lemmatize": lemmatize,
    "expand_contractions": expand_contractions,
    "remove_duplicate_lines": remove_duplicate_lines,
    "replace_unicode_and_bullet_points": replace_unicode_and_bullet_points,
    "remove_control_characters": remove_control_characters,
    "standardize_dates": standardize_dates,
    "tokenize_urls_emails": tokenize_urls_emails,
    "standardize_numbers": standardize_numbers,
    "handle_emojis": handle_emojis,
    "correct_spelling": correct_spelling,
    "standardize_punctuation": standardize_punctuation,
    "remove_accents_and_diacritics": remove_accents_and_diacritics,
    "normalize_math": normalize_math,
    "strip_leading_spaces": strip_leading_spaces,
    "handle_brackets": _handle_text_in_brackets,
    "detect_language": detect_language,
    "handle_scientific_notation": handle_scientific_notation,
    "replace_html_entities": replace_html_entities,
    "remove_directional_formatting": remove_directional_formatting,
}


###
# Main Function
##
def normalize(text: str, config: TextNormalizerConfig) -> str:
    """Normalize text using the provided configuration."""
    logger.debug(f"Original text: {text}")

    # Apply enabled steps in the specified order
    for step in config.enabled_steps:
        if step.name in FUNCTION_MAP:
            try:
                logger.debug(f"Applying {step.name}")
                func = FUNCTION_MAP[step.name]  # Look up the function by name
                if step.settings:
                    text = func(text, **step.settings)
                else:
                    text = func(text)
            except Exception as e:
                logger.error(f"Error applying {step.name}: {e}")
                continue

    logger.debug(f"Final normalized text: {text}")
    return text


###
# Usage Function


def advanced_usage():
    config = TextNormalizerConfig(settings_type="advanced")
    text = "There'd be Sample text 🥳 emojis with <b>HTML</b> and profanity like damn and \\alpha."
    text = "This is a 12/23/2005  'Sample' text fuck with can't \nSome HTML like <b>bold</b> and <i>italic</i> with profanity like damn."
    text = "● input is tied <b>Ack?!</b> to 0 debug_mode_i"
    print(normalize_text(text, config))
    return
    normalized_text = normalize_text(text, config)
    print(normalized_text)


def main():

    
    """Main function to demonstrate text normalization."""
    text = "This is a <b>sample</b> text with badword1 and badword2."

    # 1. Custom Mode
    config = TextNormalizerConfig(
        mode="custom",
        custom_steps=[
            TextCleaningStep(name="remove_html_tags"),  # Step without settings
            TextCleaningStep(
                name="filter_profanity",
                settings={
                    "custom_word_list": ["badword1", "badword2"]
                },  # Step with settings
            ),
            TextCleaningStep(name="normalize_whitespace"),  # Step without settings
        ],
    )
    normalized_text = normalize(text, config)
    print(normalized_text)

    # 2. Basic Mode
    print("=== Basic Mode ===")
    basic_config = TextNormalizerConfig(mode="basic")
    normalized_text_basic = normalize(text, basic_config)
    print(normalized_text_basic)
    print()

    # 3. Advanced Mode
    print("=== Advanced Mode ===")
    advanced_config = TextNormalizerConfig(mode="advanced")
    normalized_text_advanced = normalize(text, advanced_config)
    print(normalized_text_advanced)

    # Option 1: Use 'basic' mode
    # config_basic = TextNormalizerConfig(mode='basic')
    # normalized_text_basic = normalize_text(text, config_basic)
    # print("Basic mode:", normalized_text_basic)

    # # Option 2: Use 'advanced' mode
    # config_advanced = TextNormalizerConfig(mode='advanced')
    # normalized_text_advanced = normalize_text(text, config_advanced)
    # print("Advanced mode:", normalized_text_advanced)

    # # Option 3: Use 'custom' mode
    # config_custom = TextNormalizerConfig(
    #     mode='custom',
    #     custom_steps=['remove_html_tags', 'filter_profanity', 'normalize_whitespace']  # User-defined order
    # )
    # normalized_text_custom = normalize_text(text, config_custom)
    # print("Custom mode:", normalized_text_custom)


if __name__ == "__main__":
    main()
