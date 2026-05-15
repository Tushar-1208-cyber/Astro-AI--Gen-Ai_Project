from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

# Global variables for model and tokenizer
model = None
tokenizer = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, tokenizer
    BASE_MODEL = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
    ADAPTER_PATH = "./my_finetuned_model"
    
    try:
        print(f"🚀 Initializing AI Server with Base Model: {BASE_MODEL}...")
        tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
        
        # Optimized loading:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"📡 Using device: {device}")
        
        if device == "cuda":
            base_model = AutoModelForCausalLM.from_pretrained(
                BASE_MODEL,
                torch_dtype=torch.float16,
                device_map="auto",
                trust_remote_code=True
            )
        else:
            # CPU loading (Simpler to avoid layer mismatch)
            base_model = AutoModelForCausalLM.from_pretrained(
                BASE_MODEL,
                torch_dtype=torch.float32,
                trust_remote_code=True
            )

        
        if os.path.exists(ADAPTER_PATH):
            print(f"🪄 Loading Adapters from: {ADAPTER_PATH}...")
            # Load adapters with appropriate dtype
            model = PeftModel.from_pretrained(
                base_model, 
                ADAPTER_PATH,
                torch_dtype=torch.float16 if device == "cuda" else torch.float32,
                device_map="auto" if device == "cuda" else {"": "cpu"}
            )
            print("✅ AI Server is Ready and Loaded on GPU!" if device == "cuda" else "✅ AI Server is Ready on CPU!")
        else:
            print("⚠️ Warning: Adapter path not found. Running base model only.")
            model = base_model
            
    except Exception as e:
        print(f"❌ Critical Error during startup: {e}")
        # We don't exit, but endpoints will report 503
    yield
    # Cleanup (if needed) when the server stops
    print("Shutting down AI Server...")

# Initialize FastAPI with the lifespan handler
app = FastAPI(lifespan=lifespan)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    prompt: str
    max_tokens: int = 1024  # Increased for complex educational content
    temperature: float = 0.7

@app.get("/")
def health_check():
    return {
        "status": "ready" if model else "loading/error",
        "model": "TinyLlama-Finetuned" if model else "none"
    }

@app.post("/generate")
async def generate_text(request: ChatRequest):
    print(f"📥 Received generation request: {request.prompt[:50]}...")
    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="Model is not loaded. Check server logs.")
    
    try:
        # Don't double-prefix if it's already a structured prompt or ChatML
        if "Instruction:" in request.prompt or "<|im_start|>" in request.prompt:
            full_prompt = request.prompt
        else:
            full_prompt = f"Instruction: {request.prompt}\nResponse:"
        
        inputs = tokenizer(full_prompt, return_tensors="pt").to(model.device)
        input_len = inputs.input_ids.shape[1]
        
        # Safety check: Don't exceed 2048 total tokens
        max_new = min(request.max_tokens, 2048 - input_len - 10)
        if max_new <= 0:
            return {"response": "Error: Prompt is too long for the local model. Please try a shorter goal."}

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=max_new,
                max_length=2048,
                temperature=0.7,
                do_sample=True,
                repetition_penalty=1.1,
                pad_token_id=tokenizer.eos_token_id,
                eos_token_id=tokenizer.eos_token_id
            )
        
        full_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
        # Extract response more reliably
        if "Response:" in full_text:
            response = full_text.split("Response:")[-1].strip()
        else:
            response = full_text.replace(full_prompt, "").strip()
        
        return {"response": response}
    
    except Exception as e:
        print(f"Error during generation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # Host 0.0.0.0 allows access from other devices on the same network
    uvicorn.run(app, host="0.0.0.0", port=8000)
