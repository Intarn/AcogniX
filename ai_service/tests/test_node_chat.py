import requests
from _common import HEADERS, BASE_URL, PROJECT_ID

data = {"projectId": PROJECT_ID, "userMessage": "Dự án AcogniX tên đầy đủ là gì?"}
response = requests.post(f"{BASE_URL}/chat", headers=HEADERS, json=data)
print(response.status_code)
print(response.json())