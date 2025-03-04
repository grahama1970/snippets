import regex as re
from fuzzywuzzy import fuzz

from snippets.howto.setup_text_normalizer.cleaning.regex_patterns.get_patterns import _compile_pattern, get_patterns


def get_filtered_section_titles(text: str):
    """
    Extracts section titles using a wide-net approach and then filters the results.
    """
    patterns = get_patterns()
    section_title_patterns = patterns['section_titles']
    _filter_patterns = ['Introduction', 'Conclusion', 'Summary', 'References', 'Chapter', 'Section']
    all_matches = []
    for pattern in section_title_patterns:
        matches = pattern.finditer(text)
        all_matches.extend([m.groupdict() for m in matches])
    filtered_matches = _fuzzy_filter_section_titles(all_matches, _filter_patterns)
    return filtered_matches

def _fuzzy_filter_section_titles(matches, _filter_patterns, threshold=80):
    """
    Filters the matched section titles based on a fuzzy matching threshold.
    """
    filtered_matches = []
    filter_patterns = [_compile_pattern(p, re.IGNORECASE) for p in _filter_patterns]
    for match in matches:
        title = match.get('title', '')
        if not any((fuzz.partial_ratio(title, pattern) >= threshold for pattern in _filter_patterns)):
            filtered_matches.append(match)
    return filtered_matches

def test_section_title_regex():
    section_title_patterns = get_patterns()['section_titles']
    test_string = '4.1.5.4. BHT (Branch History Table) submodule'
    for (i, pattern) in enumerate(section_title_patterns):
        match = pattern.search(test_string)
        if match:
            print(f'Pattern {i + 1} matched:')
            for (group_name, group_value) in match.groupdict().items():
                print(f'  {group_name}: {group_value}')
            return True
    return False
if __name__ == '__main__':
    test_section_title_regex()