import { genkit } from 'genkit';
import { chroma } from 'genkitx-chromadb';
import { googleAI } from '@genkit-ai/googleai';

const AI_SERVER_URL = 'http://localhost:8000/generate';

/**
 * Astro AI Genkit Configuration
 */
export const ai = genkit({
  plugins: [
    googleAI({ 
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
      apiVersion: 'v1'
    }),
    chroma([
      {
        collectionName: 'codebase-collection',
        embedder: {
            name: 'placeholder-embedder',
            async embed() { return [new Array(384).fill(0)]; }
        },
        clientParams: {
          path: process.env.CHROMA_URL || 'http://localhost:8001',
        }
      },
    ]),
  ],
});

// Defining the model formally with a very strict return type
export const localModel = ai.defineModel(
  {
    name: 'astro-finetuned',
    label: 'Astro Fine-tuned Model',
  },
  async (input) => {
    const prompt = input.messages[input.messages.length - 1].content[0].text || "";
    
    try {
      const response = await fetch(AI_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          max_tokens: 1024,
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      console.log("📝 [Local AI Output]:", data.response.substring(0, 200) + "...");
      
      return {
        message: {
          role: 'assistant',
          content: [{ text: data.response }],
        }
      };
    } catch (error) {
      return {
        message: {
          role: 'assistant',
          content: [{ text: "AI Server connection failed. Please ensure py -3.12 ai_server.py is running." }],
        }
      };
    }
  }
);
