
'use server';

const LOCAL_AI_URL = 'http://127.0.0.1:8000/generate';

export interface GenerateQuizOutput {
  title: string;
  quizType: string;
  questions: Array<{
    question: string;
    answer: string;
    options?: string[];
  }>;
}

export async function generateQuiz(input: any) {
  const GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
  console.log(`🚀 [System] Generating Quiz for: ${input.topic} (Key: ${!!GEMINI_API_KEY})`);
  
  const prompt = `Create a ${input.quizType} quiz about "${input.topic}" with ${input.numQuestions} questions. Return ONLY JSON.`;

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
        return { ...output, quizType: input.quizType };
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
        body: JSON.stringify({ prompt, max_tokens: 1024 })
    });
    const localData = await res.json();
    const jsonMatch = localData.response.match(/\{[\s\S]*\}/);
    if (jsonMatch) return { ...JSON.parse(jsonMatch[0]), quizType: input.quizType };
  } catch (e) {
    console.error("❌ Local AI failed:", e);
  }

  throw new Error("AI Down. Check .env.local and ai_server.py.");
}
