from pydantic import BaseModel, ConfigDict
from typing import Dict, Optional, List, Literal

class TextCleaningStep(BaseModel):
    """Represents a single text cleaning step."""
    name: str  # Name of the function (e.g., 'remove_html_tags')
    settings: Optional[Dict] = None  # Optional settings for the function

class TextNormalizerConfig(BaseModel):
    """Configuration for text normalization."""
    mode: Literal['basic', 'advanced', 'custom'] = 'custom'  # Default to 'custom'
    custom_steps: Optional[List[TextCleaningStep]] = None  # List of steps for 'custom' mode

    # Predefined settings for 'basic' and 'advanced' modes
    predefined_settings: Dict[str, List[str]] = {
        'basic': ['remove_html_tags', 'normalize_whitespace'],
        'advanced': ['remove_html_tags', 'normalize_whitespace', 'filter_profanity', 'lemmatize']
    }

    @property
    def enabled_steps(self) -> List[TextCleaningStep]:
        """Get the enabled steps based on the selected mode."""
        if self.mode == 'custom':
            if self.custom_steps is None:
                raise ValueError("In 'custom' mode, 'custom_steps' must be provided.")
            return self.custom_steps
        else:
            # For 'basic' and 'advanced' modes, use predefined steps without settings
            return [TextCleaningStep(name=step) for step in self.predefined_settings[self.mode]]