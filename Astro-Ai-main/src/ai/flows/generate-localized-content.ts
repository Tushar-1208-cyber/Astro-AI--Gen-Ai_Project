
'use server';

const LOCAL_AI_URL = 'http://127.0.0.1:8000/generate';

export async function generateLocalizedContent(input: any) {
    const GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
    const langList = input.languages.split(',').map((l: string) => l.trim());
    
    // We strictly tell the AI to be FACTUALLY CORRECT and use exact keys
    const prompt = `You are an expert multilingual educator. 
    TASK: Generate a high-quality ${input.contentType} for Grade ${input.gradeLevel} about ${input.prompt}.
    LANGUAGES: ${langList.join(', ')}
    
    RULES:
    1. Be factually accurate (e.g., check moon counts, planet positions).
    2. For "quiz", use this EXACT JSON structure for EACH language:
    {
      "en": {
         "quiz": [
           { "question": "Actual Fact?", "a": "Choice 1", "b": "Choice 2", "c": "Choice 3", "d": "Choice 4", "answer": "Choice 1" }
         ]
      },
      "hi": { ... }
    }
    3. The "answer" MUST EXACTLY MATCH one of the strings in a, b, c, or d.
    4. If not a quiz, return {"en": {"content": "..."}, "hi": {"content": "..."}}.
    Return ONLY valid JSON.`;

    let rawOutput: any = null;

    try {
        console.log(`🚀 [System] Calling Gemini REST (v1beta) for Fact-Checked Content...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json" }
            }),
            cache: 'no-store'
        });
        
        const data = await response.json();
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            rawOutput = JSON.parse(data.candidates[0].content.parts[0].text);
            console.log("✅ [System] Fact-Checked Gemini Content Success!");
        }
    } catch (e) { 
        console.error("❌ [System] Gemini Failed, falling back to Local AI..."); 
    }

    if (!rawOutput) {
        try {
            const res = await fetch(LOCAL_AI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, max_tokens: 1500, temperature: 0.3 }), // Low temp for facts
                cache: 'no-store'
            });
            const localData = await res.json();
            const jsonMatch = localData.response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                rawOutput = JSON.parse(jsonMatch[0].replace(/,\s*([}\]])/g, '$1'));
            }
        } catch (e) { console.error("❌ [System] Local AI Failed"); }
    }

    if (!rawOutput) throw new Error("AI Down");

    return rawOutput;
}
