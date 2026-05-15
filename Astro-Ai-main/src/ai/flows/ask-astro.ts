import { 
    AskAstroInputSchema, 
    type AskAstroInput,
    type AskAstroOutput 
} from './ask-astro.types';

const AI_SERVER_URL = 'http://localhost:8000/generate';

/**
 * Direct Ask Astro Implementation
 * This bypasses Genkit's model validation to ensure a stable and fast connection
 * to your locally hosted fine-tuned model on GPU.
 */
export async function askAstro(input: AskAstroInput): Promise<AskAstroOutput> {
    const languageMap: Record<string, string> = {
        en: 'English', hi: 'Hindi', es: 'Spanish', fr: 'French',
        bn: 'Bengali', ta: 'Tamil', te: 'Telugu',
    };
    
    const languageName = languageMap[input.language] || 'English';
    
    // Universal AI Prompt: Answers everything!
    const prompt = `<|im_start|>system
You are 'Astro', a world-class teacher. 
Give a very LONG, DETAILED, and COMPLETE explanation. 
Write at least 250 words. Do NOT give short answers.
Explain everything step-by-step.
Always respond in ${languageName}.<|im_end|>
<|im_start|>user
${input.question}<|im_end|>
<|im_start|>assistant
`;

    console.log(`🚀 Calling Astro AI Server directly for: ${input.question.substring(0, 50)}...`);

    try {
        const response = await fetch(AI_SERVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                max_tokens: 1024,
                temperature: 0,
            }),
        });

        if (!response.ok) {
            throw new Error(`AI Server responded with ${response.status}`);
        }

        const data = await response.json();
        console.log(`✅ Success! Received response from GPU.`);

        return {
            answer: data.response || "I couldn't generate an answer right now."
        };
    } catch (error) {
        console.error('❌ Direct AI Server Error:', error);
        return {
            answer: "Connection to Astro AI Server failed. Please make sure 'py -3.12 ai_server.py' is running and showing GPU status."
        };
    }
}
