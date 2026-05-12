"""Test translations loading."""
import gettext
from pathlib import Path

LOCALES_DIR = Path("src/locales")

print("Testing translations...")
print(f"Locales directory: {LOCALES_DIR.absolute()}")
print(f"Exists: {LOCALES_DIR.exists()}")

for locale in ["es_ES", "en_EN"]:
    print(f"\n--- Testing {locale} ---")
    try:
        trans = gettext.translation(
            "messages",
            localedir=str(LOCALES_DIR),
            languages=[locale],
        )
        _ = trans.gettext
        
        # Test some keys
        test_keys = [
            "page_title",
            "form.dni_label",
            "btn.search",
            "errors.dni_required"
        ]
        
        for key in test_keys:
            translated = _(key)
            print(f"  {key} -> {translated}")
            
    except FileNotFoundError as e:
        print(f"  ERROR: {e}")
