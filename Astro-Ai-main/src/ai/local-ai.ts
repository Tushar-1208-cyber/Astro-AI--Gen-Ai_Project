/**
 * ============================================================================
 * ASTRO AI — LOCAL AI INFERENCE ENGINE
 * ============================================================================
 * 
 * Manages communication with the local fine-tuned model (TinyLlama-1.1B on FastAPI)
 * and optional local Ollama instances.
 */

function getLocalAiUrl(): string {
  const raw = process.env.LOCAL_AI_URL;
  if (!raw || raw === 'undefined' || raw.trim() === '') {
    return 'http://localhost:8000/generate';
  }
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/generate') ? trimmed : `${trimmed}/generate`;
}

function getOllamaUrl(): string {
  const raw = process.env.OLLAMA_URL;
  if (!raw || raw === 'undefined' || raw.trim() === '') {
    return 'http://localhost:11434/api/generate';
  }
  return raw.trim();
}

/**
 * Call Local AI Server with bounded timeouts and robust error classification
 */
export async function callLocalAI(prompt: string, maxTokens = 2048): Promise<string> {
  const AI_SERVER_URL = getLocalAiUrl();
  const OLLAMA_URL = getOllamaUrl();

  // 1. Optional fast probe for Ollama if explicitly configured
  const shouldTryOllama = process.env.OLLAMA_ENABLED === 'true' || process.env.OLLAMA_URL;
  if (shouldTryOllama) {
    try {
      const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3',
          prompt: prompt,
          stream: false,
          options: { num_predict: maxTokens, temperature: 0.3 }
        }),
        signal: AbortSignal.timeout(1000)
      }).catch(() => null);

      if (response && response.ok) {
        const data = await response.json();
        if (data.response && typeof data.response === 'string' && data.response.trim().length > 0) {
          console.log("✅ Ollama Responded!");
          return data.response.trim();
        }
      }
    } catch {
      // Ollama offline, proceed directly to primary local server
    }
  }

  // 2. Primary Local AI Server (TinyLlama-1.1B on FastAPI)
  try {
    console.log(`📡 Calling Local AI Server at ${AI_SERVER_URL}...`);
    const response = await fetch(AI_SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: prompt,
        max_tokens: maxTokens,
        temperature: 0.7
      }),
      signal: AbortSignal.timeout(180000) // 180s bounded timeout for local CPU/GPU execution
    });

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        errorDetail = errJson.detail || errorDetail;
      } catch {
        // use status text
      }
      throw new Error(`Local AI server error: ${errorDetail}`);
    }

    let data = await response.json();
    if (!data || typeof data.response !== 'string' || data.response.trim().length === 0) {
      console.warn("⚠️ Local AI returned empty response, performing one retry...");
      const retryRes = await fetch(AI_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          max_tokens: maxTokens,
          temperature: 0.6
        }),
        signal: AbortSignal.timeout(180000)
      });
      if (retryRes.ok) {
        data = await retryRes.json();
      }
    }

    if (!data || typeof data.response !== 'string' || data.response.trim().length === 0) {
      throw new Error("Local AI server returned an empty generation payload.");
    }

    console.log("✅ TinyLlama Responded!");
    return data.response.trim();

  } catch (error: any) {
    if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
      throw new Error(`Local AI generation timed out after 180 seconds. The model may be overburdened or running on CPU.`);
    }
    if (error.cause?.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
      throw new Error(`Cannot connect to Local AI server. Please ensure the local AI service is running and accessible.`);
    }
    throw error;
  }
}

/**
 * Robust JSON Extractor & Repair Engine
 */
export function extractJSON(text: string): any {
  if (!text || text.trim().length === 0) {
    throw new Error("Format Error: Empty text provided for JSON extraction.");
  }

  // Strip Markdown code fences if present (e.g. ```json ... ```)
  let cleanedText = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();

  // Find boundaries of the outermost JSON object or array
  const firstBrace = cleanedText.indexOf('{');
  const firstBracket = cleanedText.indexOf('[');
  
  let start = -1;
  let end = -1;
  let isArray = false;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    end = cleanedText.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    start = firstBracket;
    end = cleanedText.lastIndexOf(']');
    isArray = true;
  }

  if (start === -1 || end === -1 || end <= start) {
    console.error("🔍 Raw AI Output (No JSON found):", text.substring(0, 300));
    throw new Error("Format Error: No JSON found in AI response.");
  }

  const jsonStr = cleanedText.substring(start, end + 1);

  // Attempt 1: Direct JSON parse
  try {
    return JSON.parse(jsonStr);
  } catch (parseError) {
    console.warn("⚠️ Initial JSON parse failed, attempting automated repair...");

    // Repair 1: Remove trailing commas before closing braces/brackets
    let repaired = jsonStr.replace(/,\s*([}\]])/g, '$1');

    // Repair 2: Escape unescaped newlines within quoted string values
    repaired = repaired.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match, p1) => {
      return '"' + p1.replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
    });

    // Repair 3: Replace single quotes with double quotes around keys/values
    repaired = repaired.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

    try {
      return JSON.parse(repaired);
    } catch (repairError) {
      console.error("❌ JSON Repair failed. Extracted substring was:", jsonStr.substring(0, 300));
      throw new Error("Format Error: Invalid JSON structure after automated repair attempt.");
    }
  }
}
