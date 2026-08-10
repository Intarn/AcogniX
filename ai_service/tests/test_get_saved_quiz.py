import requests
from _common import HEADERS, BASE_URL, PROJECT_ID

response = requests.get(f"{BASE_URL}/projects/{PROJECT_ID}/quizzes", headers=HEADERS)
print(response.status_code)
print(response.json())