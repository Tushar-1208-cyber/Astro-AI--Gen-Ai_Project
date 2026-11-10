'use server';

import { type AppChatbotInput, type AppChatbotOutput } from './app-chatbot.types';
import { executeTextGeneration } from '../provider';

export async function appChatbot(input: AppChatbotInput): Promise<AppChatbotOutput> {
    const prompt = `You are Astro's AI Assistant for the educational platform. Give a clear, helpful response to: ${input.query}`;

    const response = await executeTextGeneration({
        prompt,
        maxTokens: 1024,
        temperature: 0.7,
        capability: 'text-generation'
    });

    return { response };
}
