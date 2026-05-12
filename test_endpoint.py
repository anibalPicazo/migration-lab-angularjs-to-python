"""Test script to capture the full error."""
import sys
import traceback
from fastapi.testclient import TestClient

try:
    from src.main import app
    
    client = TestClient(app)
    response = client.get("/consulta-estados-cuentas")
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:500]}")
    
except Exception as e:
    print("ERROR OCCURRED:")
    print(traceback.format_exc())
    sys.exit(1)
