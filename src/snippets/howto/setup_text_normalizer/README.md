How to setup the text normalizer. Remember to install the text_normalizer packaged first

```python
from snippets.src.snippets.cleaning.text_normalizer.text_normalizer import (
    normalize, 
    TextNormalizerConfig
)
basic_config = TextNormalizerConfig(mode="basic")
text = "Hello, world! Damn, that's a lot of text."
normalized_text_basic = normalize(text, basic_config)
print(normalized_text_basic)
```

