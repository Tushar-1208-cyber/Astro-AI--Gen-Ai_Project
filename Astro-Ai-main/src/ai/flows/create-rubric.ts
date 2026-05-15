
'use server';

const LOCAL_AI_URL = 'http://127.0.0.1:8000/generate';

export async function createRubric(input: any) {
    const GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
    
    // Prompt with NO DOTS, ONLY REAL SENTENCES
    const prompt = `You are a professional teacher. Create a detailed grading rubric for:
    Assignment: ${input.assignmentDescription}
    Criteria: ${input.criteria.join(', ')}
    
    Return ONLY a JSON object. 
    
    Example Structure (Fill with deep, professional descriptions):
    {
      "title": "Professional Rubric",
      "criteria": [
        {
          "name": "Grammar",
          "levels": [
            { "level": "Excellent", "description": "The work is flawlessly written with perfect grammar and punctuation." },
            { "level": "Good", "description": "The work is mostly clear with minor errors that do not hinder understanding." },
            { "level": "Needs Improvement", "description": "Multiple grammatical errors make the work difficult to read." }
          ]
        }
      ]
    }`;

    let rawOutput: any = null;

    try {
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
        }
    } catch (e) { console.error("Gemini failed"); }

    if (!rawOutput) {
        try {
            const res = await fetch(LOCAL_AI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, max_tokens: 1000, temperature: 0.8 }),
                cache: 'no-store'
            });
            const localData = await res.json();
            const jsonMatch = localData.response.match(/\{[\s\S]*\}/);
            if (jsonMatch) rawOutput = JSON.parse(jsonMatch[0]);
        } catch (e) { console.error("Local AI failed"); }
    }

    if (!rawOutput) throw new Error("AI Down");

    // ULTIMATE SANITIZER: Detects dots or placeholders and REPLACES them with real text
    const sanitized: any = {
        title: rawOutput.title && !rawOutput.title.includes("Title") && !rawOutput.title.includes("...") ? rawOutput.title : `Grading Rubric for ${input.assignmentDescription.substring(0, 20)}`,
        criteria: []
    };

    const sourceCriteria = Array.isArray(rawOutput.criteria) ? rawOutput.criteria : (input.criteria.map((c: string) => ({ name: c })));

    sanitized.criteria = sourceCriteria.map((c: any, index: number) => {
        const name = (c.name && !c.name.includes("Name") && !c.name.includes("...")) ? c.name : (input.criteria[index] || "Educational Quality");
        let levels = Array.isArray(c.levels) ? c.levels : [];
        
        // Check if levels are missing OR contain dots/placeholders
        const isBadData = levels.length === 0 || levels.some((l: any) => !l.description || l.description.includes("...") || l.description.includes("Specific") || l.description.length < 5);

        if (isBadData) {
            levels = [
                { level: "Excellent", description: `The student demonstrates complete mastery of ${name} with highly professional execution and zero errors.` },
                { level: "Good", description: `The student shows a strong understanding of ${name} with only minor inconsistencies or very few errors.` },
                { level: "Needs Improvement", description: `The student lacks basic proficiency in ${name}. Significant errors or omissions are present throughout the work.` }
            ];
        }
        return { name, levels };
    });

    return sanitized;
}
