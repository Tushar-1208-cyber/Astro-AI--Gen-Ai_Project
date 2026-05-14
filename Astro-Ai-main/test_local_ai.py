
import json
import urllib.request

LOCAL_URL = "http://localhost:8000/generate"

try:
    print("Testing Local AI Server...")
    post_data = json.dumps({"prompt": "Write a one-sentence fact about the Sun.", "max_tokens": 50}).encode('utf-8')
    req = urllib.request.Request(LOCAL_URL, data=post_data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as response:
        print("Response received!")
        print(response.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
