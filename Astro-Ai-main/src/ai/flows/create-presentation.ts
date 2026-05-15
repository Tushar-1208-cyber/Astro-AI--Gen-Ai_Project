
'use server';

const LOCAL_AI_URL = 'http://127.0.0.1:8000/generate';

export async function createPresentation(input: any) {
    const GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
    console.log(`🚀 [System] Generating Presentation for: ${input.topic} (Key: ${!!GEMINI_API_KEY})`);
    
    const prompt = `Create a presentation about "${input.topic}" with ${input.numSlides} slides. Return ONLY JSON.`;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        const data = await response.json();
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            const output = JSON.parse(data.candidates[0].content.parts[0].text);
            return {
                title: output.title,
                slides: output.slides.map((s: any) => ({ ...s, imageDataUri: "" }))
            };
        }
        console.error("❌ Gemini Error:", JSON.stringify(data));
    } catch (e) {
        console.error("❌ Gemini Fetch failed:", e);
    }

    console.warn("⚠️ Switching to Local AI...");
    try {
        const res = await fetch(LOCAL_AI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, max_tokens: 2048 })
        });
        const localData = await res.json();
        const jsonMatch = localData.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const output = JSON.parse(jsonMatch[0]);
            return {
                title: output.title || input.topic,
                slides: output.slides.map((s: any) => ({ ...s, imageDataUri: "" }))
            };
        }
    } catch (e) {
        console.error("❌ Local AI failed:", e);
    }

    throw new Error("AI Down. Check .env.local and ai_server.py.");
}
