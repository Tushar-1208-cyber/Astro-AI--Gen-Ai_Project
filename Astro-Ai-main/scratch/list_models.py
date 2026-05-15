import requests
import json

api_key = "AIzaSyD4CBbdNwtlzcoeZdO9qZF-0o3Ck3lN1JM"
url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"

try:
    response = requests.get(url)
    if response.status_code == 200:
        models = response.json().get('models', [])
        print("Available Models:")
        for model in models:
            print(f"- {model['name']}")
    else:
        print(f"Error {response.status_code}: {response.text}")
except Exception as e:
    print(f"Connection Error: {e}")
