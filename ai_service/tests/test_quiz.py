import requests

url = "http://localhost:8000/api/generate-quiz"
headers = {"X-Internal-Secret": "fc14dccebfd730412419bf071b76601b6c1a214267d32092d7cd48f7a5313056"}
data = {
    "projectId": "dcea2e78-0ffd-4c46-bf9b-12bcb65de983",
    "questionCount": 3,
    "difficulty": "hard"
}

response = requests.post(url, headers=headers, json=data)
print(response.status_code)
print(response.json())