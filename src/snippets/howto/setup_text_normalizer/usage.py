"""How to use text normalizer"""
from snippets.howto.setup_text_normalizer.text_normalizer import (
    normalize,
    TextNormalizerConfig
)

basic_config = TextNormalizerConfig(mode="basic")
text = "Hello, world! Damn, that's a lot of text."
normalized_text_basic = normalize(text, basic_config)
print(normalized_text_basic) 