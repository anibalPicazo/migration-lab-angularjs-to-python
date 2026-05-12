"""Test template rendering with translations."""
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

print("Testing template rendering with translations...\n")

# Test Spanish (default)
print("=== Testing Spanish (es_ES) ===")
response = client.get("/consulta-estados-cuentas")
html = response.text

# Check if translations are working (not showing keys)
checks_es = [
    ("DNI:", "form.dni_label translated"),
    ("Buscar", "btn.search translated"),
    ("Ej. 12345678Z", "form.dni_placeholder translated"),
    ("Consulta Estados Cuenta", "page_title translated"),
]

for text, description in checks_es:
    if text in html:
        print(f"✓ {description}: Found '{text}'")
    else:
        print(f"✗ {description}: NOT FOUND")

# Check for untranslated keys (these should NOT appear)
bad_keys = ["form.dni_label", "btn.search", "form.dni_placeholder", "form.dni_help"]
for key in bad_keys:
    if key in html:
        print(f"✗ ERROR: Untranslated key found: {key}")
    else:
        print(f"✓ Key '{key}' is translated")

print("\n=== Testing English (en_EN) ===")
response = client.get("/consulta-estados-cuentas", cookies={"lang": "en_EN"})
html = response.text

checks_en = [
    ("DNI:", "form.dni_label translated"),
    ("Search", "btn.search translated"),
    ("e.g., 12345678Z", "form.dni_placeholder translated"),
    ("Account Status Inquiry", "page_title translated"),
]

for text, description in checks_en:
    if text in html:
        print(f"✓ {description}: Found '{text}'")
    else:
        print(f"✗ {description}: NOT FOUND")

# Check for untranslated keys
for key in bad_keys:
    if key in html:
        print(f"✗ ERROR: Untranslated key found: {key}")
    else:
        print(f"✓ Key '{key}' is translated")
