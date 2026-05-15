import { 
    AppChatbotInputSchema, 
    AppChatbotOutputSchema,
    type AppChatbotInput,
    type AppChatbotOutput 
} from './app-chatbot.types';

const OLLAMA_URL = 'http://localhost:11434/api/generate';

export async function appChatbot(input: AppChatbotInput): Promise<AppChatbotOutput> {
    console.log(`🦙 Chatbot: Calling Ollama for: ${input.query.substring(0, 30)}...`);

    try {
        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3', // Default Ollama model
                prompt: `You are Astro's AI Assistant. Give a helpful response to: ${input.query}`,
                stream: false,
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama responded with ${response.status}`);
        }

        const data = await response.json();
        
        return { 
            response: data.response || "Ollama generated an empty response." 
        };
    } catch (error) {
        console.error('❌ Chatbot Ollama Error:', error);
        return { 
            response: "I can't reach Ollama. Please make sure Ollama is RUNNING on your laptop and you have the 'llama3' model downloaded (`ollama run llama3`)." 
        };
    }
}
