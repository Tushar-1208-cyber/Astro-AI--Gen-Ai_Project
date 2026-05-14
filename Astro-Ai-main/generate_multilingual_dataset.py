
import json
import urllib.request
import urllib.parse
import time

LOCAL_URL = "http://localhost:8000/generate"

def generate_multilingual_data():
    languages = ["English", "Hindi", "Bengali", "Bhojpuri"]
    topics = ["Science", "History", "Geography"]
    
    dataset = []
    
    print("Starting reliable local data generation (1 sample at a time)...")
    
    for lang in languages:
        for topic in topics:
            for i in range(2): # 2 samples per topic
                print(f"Generating sample {i+1} for {lang} - {topic}...")
                
                # Super simple prompt for TinyLlama
                prompt = f"Create a school question about {topic} in {lang}. Output only JSON like this: {{\"id\": \"id\", \"language\": \"{lang.lower()}\", \"topic\": \"{topic}\", \"context\": \"2 sentences about {topic} in {lang}.\", \"question\": \"Question?\", \"answers\": {{\"text\": [\"Ans\"], \"answer_start\": [10]}}, \"source_url\": \"url\"}}"

                try:
                    post_data = json.dumps({
                        "prompt": prompt,
                        "max_tokens": 500,
                        "temperature": 0.3
                    }).encode('utf-8')
                    
                    req = urllib.request.Request(LOCAL_URL, data=post_data, headers={'Content-Type': 'application/json'})
                    
                    with urllib.request.urlopen(req) as response:
                        res_body = response.read().decode('utf-8')
                        data = json.loads(res_body)
                        response_text = data.get("response", "").strip()
                        
                        # Extract JSON
                        json_start = response_text.find("{")
                        json_end = response_text.rfind("}") + 1
                        if json_start != -1 and json_end != -1:
                            sample = json.loads(response_text[json_start:json_end])
                            dataset.append(sample)
                            print(f"Added sample for {lang}.")
                        else:
                            print(f"Failed to find JSON in response.")
                except Exception as e:
                    print(f"Error: {e}")
                
                time.sleep(1) # Small gap for local server

    # Save
    with open("multilingual_dataset_original.json", "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2, ensure_ascii=False)
    
    print(f"\nDONE! Total samples: {len(dataset)}")

if __name__ == "__main__":
    generate_multilingual_data()
