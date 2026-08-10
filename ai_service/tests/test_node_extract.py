import requests
from _common import HEADERS, BASE_URL, PROJECT_ID

data = {"materialId": "e98014b1-c5aa-4444-9ae2-738c988e7b18"}
files = {"document": ("report.pdf", open(r"C:\Users\Hoc Nguyen\Downloads\Weekly Report Week 7.docx.pdf", "rb"), "application/pdf")}

response = requests.post(f"{BASE_URL}/extract-text", headers=HEADERS, data=data, files=files)
print(response.status_code)
print(response.json())