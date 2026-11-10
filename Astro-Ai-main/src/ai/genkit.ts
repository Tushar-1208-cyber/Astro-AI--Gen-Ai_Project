import { genkit } from 'genkit';
import { chroma } from 'genkitx-chromadb';
import { googleAI, textEmbedding004 } from '@genkit-ai/googleai';
import { callLocalAI } from './local-ai';

const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;

/**
 * Astro AI Genkit Configuration
 */
export const ai = genkit({
  plugins: [
    googleAI({ 
      apiKey: apiKey || 'NO_KEY_PROVIDED',
      apiVersion: 'v1beta'
    }),
    chroma([
      {
        collectionName: 'codebase-collection',
        embedder: textEmbedding004,
        clientParams: {
          path: process.env.CHROMA_URL || 'http://localhost:8001',
        }
      },
    ]),
  ],
});

// Defining the local model formally as a registered Genkit model
export const localModel = ai.defineModel(
  {
    name: 'astro-finetuned',
    label: 'Astro Fine-tuned Model',
  },
  async (input) => {
    const lastMessage = input.messages[input.messages.length - 1];
    const prompt = lastMessage?.content?.find((c: any) => c.text)?.text || "";
    
    const textOutput = await callLocalAI(prompt, 1024);
    
    return {
      message: {
        role: 'model' as const,
        content: [{ text: textOutput }],
      }
    };
  }
);

