"""Debug script to check header rendering."""

from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)

# Set Spanish language cookie
client.cookies.set("lang", "es_ES")

response = client.get("/consulta-estados-cuentas")

print("Status code:", response.status_code)
print("\n=== Checking for translated text ===")

# Check if the header is in the response
if "<header" in response.text:
    print("✓ Header element found")
    # Find the header section
    start = response.text.find("<header")
    end = response.text.find("</header>", start) + 9
    header_html = response.text[start:end]
    print("\nHeader HTML:")
    print(header_html)
else:
    print("✗ Header element NOT found")

# Check for translated title
if "Consulta Estados Cuenta" in response.text:
    print("\n✓ Spanish title 'Consulta Estados Cuenta' found!")
else:
    print("\n✗ Spanish title 'Consulta Estados Cuenta' NOT found")

# Check for  page_title key (should not be there)
if "page_title" in response.text:
    print("✗ Untranslated key 'page_title' found (BAD)")
else:
    print("✓ Untranslated key 'page_title' not found (GOOD)")
