
'use server';

const LOCAL_AI_URL = 'http://127.0.0.1:8000/generate';

export async function adaptContentGradeLevel(input: { content: string, gradeLevel: number }) {
    const GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
    
    // We trim the content to ensure we don't exceed token limits
    const safeContent = input.content.substring(0, 1500);

    const prompt = `You are an expert pedagogical editor. 
    TASK: Adapt the following content to be age-appropriate and easy to understand for Grade ${input.gradeLevel} students.
    CONTENT: ${safeContent}
    
    Maintain the core message but simplify the vocabulary and sentence structure. 
    Return ONLY the adapted text.`;

    let adaptedContent: string = "";

    // 1. Try Gemini REST (Best Quality)
    try {
        console.log(`🚀 [System] Adapting content to Grade ${input.gradeLevel} using Gemini...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            }),
            cache: 'no-store'
        });
        
        const data = await response.json();
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            adaptedContent = data.candidates[0].content.parts[0].text;
            console.log("✅ [System] Gemini Adaptation Success!");
        } else {
            console.error("❌ [System] Gemini Response Error:", JSON.stringify(data).substring(0, 200));
        }
    } catch (e) { 
        console.error("❌ [System] Gemini Network Error:", e); 
    }

    // 2. Fallback to Local AI (Privacy/Offline)
    if (!adaptedContent) {
        try {
            console.log("📡 [System] Falling back to Local AI for Adaptation...");
            const res = await fetch(LOCAL_AI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, max_tokens: 800, temperature: 0.7 }),
                cache: 'no-store'
            });
            const localData = await res.json();
            adaptedContent = localData.response;
            console.log("✅ [System] Local AI Adaptation Success!");
        } catch (e) { 
            console.error("❌ [System] Local AI Adaptation Failed (Connection Refused)"); 
        }
    }

    if (!adaptedContent) {
        throw new Error("AI Down");
    }

    return { adaptedContent: adaptedContent.trim() };
}
