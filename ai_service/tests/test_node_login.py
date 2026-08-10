import requests

url = "http://localhost:5000/api/auth/login"
data = {"email": "dgbaonhi2006@gmail.com", "password": "123456"}

response = requests.post(url, json=data)
print(response.status_code)
result = response.json()
print(result)

if "token" in result:
    with open("token.txt", "w") as f:
        f.write(result["token"])