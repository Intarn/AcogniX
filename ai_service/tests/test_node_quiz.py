import requests
from _common import HEADERS, BASE_URL, PROJECT_ID

data = {"projectId": PROJECT_ID, "questionCount": 3, "difficulty": "easy"}
response = requests.post(f"{BASE_URL}/generate-quiz", headers=HEADERS, json=data)
print(response.status_code)
print(response.json())