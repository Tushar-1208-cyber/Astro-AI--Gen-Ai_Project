
'use server';

const LOCAL_AI_URL = 'http://127.0.0.1:8000/generate';

export async function getProfessionalDevelopmentPlan(input: any) {
    const GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
    
    const prompt = `You are an expert instructional coach. Create a professional development plan for a teacher with this goal: ${input.learningGoal}.
    
    Return ONLY a JSON object:
    {
      "planTitle": "Detailed Growth Plan Title",
      "keyConcepts": ["Expert Concept 1", "Expert Concept 2"],
      "suggestedSteps": [
        {
          "title": "Actionable Step Title",
          "description": "Deep pedagogical explanation.",
          "strategies": ["Specific strategy 1", "Specific strategy 2"],
          "youtubeSearchQuery": "precise keywords"
        }
      ]
    }`;

    let rawOutput: any = null;

    try {
        console.log("🚀 [System] Trying Gemini for Teacher PD...");
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
            console.log("✅ [System] Gemini Success!");
        } else {
            console.error("❌ [System] Gemini Error Details:", JSON.stringify(data).substring(0, 200));
        }
    } catch (e) { 
        console.error("❌ [System] Gemini Network Error:", e); 
    }

    if (!rawOutput) {
        try {
            console.log("📡 [System] Falling back to Local AI...");
            const res = await fetch(LOCAL_AI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, max_tokens: 800, temperature: 0.7 }),
                cache: 'no-store'
            });
            
            if (!res.ok) {
                const errText = await res.text();
                console.error(`❌ [System] Local AI Server Error (${res.status}):`, errText);
            } else {
                const localData = await res.json();
                // Improved extraction: Handle markdown blocks and extra text
                let cleanResponse = localData.response.trim();
                if (cleanResponse.includes('```json')) {
                    cleanResponse = cleanResponse.split('```json')[1].split('```')[0];
                } else if (cleanResponse.includes('```')) {
                    cleanResponse = cleanResponse.split('```')[1].split('```')[0];
                }
                
                const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        rawOutput = JSON.parse(jsonMatch[0]);
                        console.log("✅ [System] Local AI Success!");
                    } catch (parseErr) {
                        console.error("❌ [System] JSON Parse Error in local response:", parseErr);
                    }
                }
            }
        } catch (e) { 
            console.error("❌ [System] Local AI Connection Refused. Is py server running?"); 
        }
    }

    if (!rawOutput) {
        throw new Error("AI Down");
    }

    // Sanitizer
    return {
        planTitle: rawOutput.planTitle || `Plan for ${input.learningGoal}`,
        keyConcepts: Array.isArray(rawOutput.keyConcepts) ? rawOutput.keyConcepts : ["Pedagogy"],
        suggestedSteps: (Array.isArray(rawOutput.suggestedSteps) ? rawOutput.suggestedSteps : []).map((step: any) => ({
            title: step.title || "Step",
            description: step.description || "Learn more about this.",
            strategies: Array.isArray(step.strategies) ? step.strategies : ["Practice"],
            youtubeSearchQuery: step.youtubeSearchQuery || input.learningGoal
        }))
    };
}
