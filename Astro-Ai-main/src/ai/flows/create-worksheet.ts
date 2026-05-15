
'use server';

const LOCAL_AI_URL = 'http://127.0.0.1:8000/generate';

export async function createWorksheet(input: any) {
    const GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
    
    const prompt = `You are an expert instructional designer. Create a high-quality educational worksheet for Grade ${input.gradeLevel} about: ${input.topic}.
    Include exactly ${input.numQuestions} diverse and challenging questions.
    
    EXAMPLE FORMAT:
    {
      "title": "The Wonders of Photosynthesis",
      "questions": [
        {
          "question": "Which gas do plants absorb from the atmosphere?",
          "type": "multiple-choice", 
          "options": ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"],
          "answer": "Carbon Dioxide"
        }
      ]
    }

    Return ONLY the JSON object. Use types: 'multiple-choice', 'true-false', 'short-answer', 'fill-in-the-blank'.`;

    let rawOutput: any = null;

    // 1. Try Gemini (REST)
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

    // 2. Fallback to Local AI
    if (!rawOutput) {
        try {
            const res = await fetch(LOCAL_AI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, max_tokens: 1000, temperature: 0.7 }),
                cache: 'no-store'
            });
            const localData = await res.json();
            const jsonMatch = localData.response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    // Manual repair for TinyLlama quirks
                    let fixed = jsonMatch[0].replace(/,\s*([}\]])/g, '$1');
                    rawOutput = JSON.parse(fixed);
                } catch(e) { console.error("Local JSON Parse Error"); }
            }
        } catch (e) { console.error("Local AI failed"); }
    }

    if (!rawOutput) throw new Error("AI Down");

    // 3. The Master Sanitizer (No more "Question text?")
    const topics = input.topic.split(' ');
    const mainTopic = topics[topics.length - 1];

    return {
        title: rawOutput.title || `${input.topic} Mastery Worksheet`,
        questions: (Array.isArray(rawOutput.questions) ? rawOutput.questions : []).map((q: any, i: number) => {
            const sanitizedType = q.type || (q.options?.length > 0 ? "multiple-choice" : "short-answer");
            
            // If AI gave dummy text, we generate a better placeholder based on the topic
            let sanitizedQuestion = q.question || "";
            if (!sanitizedQuestion || sanitizedQuestion.includes('Question text') || sanitizedQuestion.length < 5) {
                const placeholders = [
                    `Explain the importance of ${mainTopic} in our daily lives.`,
                    `What are the three main characteristics of ${mainTopic}?`,
                    `How does ${mainTopic} affect the environment?`,
                    `Identify one real-world example of ${mainTopic}.`,
                    `Describe the process of ${mainTopic} step by step.`
                ];
                sanitizedQuestion = placeholders[i % placeholders.length];
            }

            return {
                question: sanitizedQuestion,
                type: sanitizedType,
                options: Array.isArray(q.options) && q.options.length > 0 ? q.options : 
                         (sanitizedType === 'multiple-choice' ? ["Option A", "Option B", "Option C", "Option D"] : 
                          sanitizedType === 'true-false' ? ["True", "False"] : []),
                answer: q.answer || ""
            };
        })
    };
}
