import requests
from _common import HEADERS, BASE_URL, PROJECT_ID

data = {"projectId": PROJECT_ID, "flashcardCount": 5, "length": "short"}
response = requests.post(f"{BASE_URL}/generate-flashcards", headers=HEADERS, json=data)
print(response.status_code)
print(response.json())