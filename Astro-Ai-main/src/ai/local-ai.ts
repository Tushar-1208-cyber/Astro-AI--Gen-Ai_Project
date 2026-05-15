
const AI_SERVER_URL = 'http://localhost:8000/generate';
const OLLAMA_URL = 'http://localhost:11434/api/generate';

/**
 * Local AI Helper - Now uses Ollama (Llama 3) for high quality JSON fallback!
 */
export async function callLocalAI(prompt: string, maxTokens = 2048) {
    try {
        console.log("📡 Attempting Ollama (Llama 3)...");
        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3',
                prompt: prompt,
                stream: false,
                options: { num_predict: maxTokens, temperature: 0.3 }
            }),
        }).catch(() => null);

        if (response && response.ok) {
            const data = await response.json();
            console.log("✅ Ollama Responded!");
            return data.response || "";
        }
        
        console.warn("⚠️ Ollama not reachable or failed. Trying TinyLlama (ai_server.py)...");
        const altResponse = await fetch(AI_SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, max_tokens: maxTokens }),
        }).catch(() => null);

        if (altResponse && altResponse.ok) {
            const altData = await altResponse.json();
            console.log("✅ TinyLlama Responded!");
            return altData.response || "";
        }

        throw new Error("No Local AI server reachable (Ollama or TinyLlama)");

    } catch (error: any) {
        console.error('❌ Local AI Error:', error.message);
        return "";
    }
}

/**
 * Robust JSON extractor
 */
export function extractJSON(text: string) {
    // 1. Find the first '{' and last '}'
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
        console.error("🔍 Raw AI Output (No JSON):", text);
        throw new Error("Format Error: No JSON found in AI response.");
    }
    
    let jsonStr = text.substring(start, end + 1);
    
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        console.warn("⚠️ JSON Parse failed, attempting repair...");
        
        // REPAIR 1: Remove trailing commas before } or ]
        let cleaned = jsonStr.replace(/,\s*([}\]])/g, '$1');
        
        // REPAIR 2: Handle unescaped newlines inside strings (common in TinyLlama)
        // We find content inside quotes and replace real newlines with \n
        cleaned = cleaned.replace(/"([^"]*)"/g, (match, p1) => {
            return '"' + p1.replace(/\n/g, '\\n') + '"';
        });

        try {
            return JSON.parse(cleaned);
        } catch (e2) {
            console.error("❌ JSON Repair failed. Raw:", jsonStr);
            throw new Error("Format Error: Invalid JSON structure after repair attempt.");
        }
    }
}
