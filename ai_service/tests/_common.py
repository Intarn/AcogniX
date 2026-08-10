# _common.py
with open("token.txt") as f:
    TOKEN = f.read().strip()

HEADERS = {"Authorization": f"Bearer {TOKEN}"}
BASE_URL = "http://localhost:5000/api/ai"
PROJECT_ID = "dcea2e78-0ffd-4c46-bf9b-12bcb65de983"