import requests

url = "http://localhost:8000/api/chat"
headers = {"X-Internal-Secret": "fc14dccebfd730412419bf071b76601b6c1a214267d32092d7cd48f7a5313056"}
data = {
    "projectId": "dcea2e78-0ffd-4c46-bf9b-12bcb65de983",
    "userMessage": "Nhóm này có bao nhiêu thành viên và họ tên là gì?"
}

response = requests.post(url, headers=headers, json=data)
print(response.status_code)
result = response.json()
print(result)

# Lưu conversationId để test lượt chat thứ 2 (kiểm tra nối tiếp hội thoại)
if "conversationId" in result:
    with open("last_conversation_id.txt", "w") as f:
        f.write(result["conversationId"])