import requests
from _common import HEADERS, BASE_URL, PROJECT_ID

conversation_id = "b0861c30-9f5d-48e2-bd5a-41514e8754d1"
response = requests.get(f"{BASE_URL}/projects/{PROJECT_ID}/conversation?conversationId={conversation_id}", headers=HEADERS)
print(response.status_code)
print(response.json())