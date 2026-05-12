"""Test script for consultar-todos endpoint."""

import json

import requests

# Step 1: Search for DNI
print("Step 1: Searching for DNI 12345678Z...")
response1 = requests.post(
    "http://127.0.0.1:8000/consulta-estados-cuentas/buscar-dni",
    data={"dni": "12345678Z"},
    allow_redirects=False,
)
print(f"Status: {response1.status_code}")
print(f"Location: {response1.headers.get('location')}")

# Follow redirect
if response1.status_code == 303:
    location = response1.headers.get("location")
    response1_get = requests.get(f"http://127.0.0.1:8000{location}")
    print(f"Followed redirect, status: {response1_get.status_code}")

    # Extract cuentas_json from URL (simplified)
    from urllib.parse import parse_qs, urlparse

    parsed = urlparse(location)
    params = parse_qs(parsed.query)
    cuentas_json = params.get("cuentas_json", [""])[0]
    dni = params.get("dni", [""])[0]

    print(f"\nExtracted DNI: {dni}")
    print(f"Extracted cuentas_json: {cuentas_json[:100]}...")

# Step 2: Test consultar-todos
print("\n\nStep 2: Testing consultar-todos...")

# Create test data
cuentas_test = json.dumps(
    [
        {"id": "ACC001", "estado": None},
        {"id": "ACC002", "estado": None},
        {"id": "ACC003", "estado": None},
    ]
)

print(f"Sending cuentas_json: {cuentas_test}")
print("Sending dni: 12345678Z")

response2 = requests.post(
    "http://127.0.0.1:8000/consulta-estados-cuentas/consultar-todos",
    data={"cuentas_json": cuentas_test, "dni": "12345678Z"},
    allow_redirects=False,
)

print(f"\nResponse status: {response2.status_code}")
print(f"Response headers: {response2.headers}")

if response2.status_code == 303:
    location = response2.headers.get("location")
    print(f"Redirect location: {location}")

    # Follow redirect
    response2_get = requests.get(f"http://127.0.0.1:8000{location}")
    print(f"Followed redirect, status: {response2_get.status_code}")

    # Check for errors in response
    if b'<div class="error">' in response2_get.content:
        print("\nERROR FOUND IN RESPONSE!")
        # Extract error message
        start = response2_get.content.find(b'<div class="error">')
        if start > 0:
            end = response2_get.content.find(b"</div>", start)
            error_html = response2_get.content[start : end + 6]
            print(f"Error HTML: {error_html.decode('utf-8')}")
    else:
        print("\nSUCCESS - No errors found!")

    # Check if estados are updated
    if b"ACTIVO" in response2_get.content or b"BLOQUEADO" in response2_get.content:
        print("Estados were successfully updated!")
