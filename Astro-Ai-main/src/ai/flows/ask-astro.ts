'use server';

import { type AskAstroInput, type AskAstroOutput } from './ask-astro.types';
import { executeTextGeneration } from '../provider';

/**
 * Ask Astro AI Flow
 * Connected to centralized provider with local-first execution
 */
export async function askAstro(input: AskAstroInput): Promise<AskAstroOutput> {
    const languageMap: Record<string, string> = {
        en: 'English', hi: 'Hindi', es: 'Spanish', fr: 'French',
        bn: 'Bengali', ta: 'Tamil', te: 'Telugu',
    };
    
    const languageName = languageMap[input.language] || 'English';
    
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

    console.log(`🚀 [Ask Astro] Request: ${input.question.substring(0, 50)}...`);

    const answer = await executeTextGeneration({
        prompt,
        maxTokens: 1024,
        temperature: 0.7,
        capability: 'text-generation'
    });

    return { answer };
}
