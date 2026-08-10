import requests

url = "http://localhost:8000/api/extract"
headers = {"X-Internal-Secret": "fc14dccebfd730412419bf071b76601b6c1a214267d32092d7cd48f7a5313056"}
data = {"materialId": "e98014b1-c5aa-4444-9ae2-738c988e7b18"}

file_path = r"C:\Users\Hoc Nguyen\Downloads\Weekly Report Week 7.docx.pdf"
files = {"file": ("report.pdf", open(file_path, "rb"), "application/pdf")}

response = requests.post(url, headers=headers, data=data, files=files)
print(response.status_code)
print(response.json())