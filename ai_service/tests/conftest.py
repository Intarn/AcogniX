import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Dummy env vars so config.py's required os.environ[...] lookups don't crash
# when running tests without a real .env / real credentials.
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault(
    "SUPABASE_SERVICE_ROLE_KEY", 
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.dummy_signature_123456789"
)
os.environ.setdefault("AI_SERVICE_INTERNAL_SECRET", "test-internal-secret")

import pytest
from fastapi.testclient import TestClient

import config
from main import app


@pytest.fixture
def internal_headers():
    return {"X-Internal-Secret": config.INTERNAL_SERVICE_SECRET}


@pytest.fixture
def client():
    return TestClient(app)