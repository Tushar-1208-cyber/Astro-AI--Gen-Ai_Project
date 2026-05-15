'use server';
/**
 * @fileOverview An AI agent that enhances writing by checking grammar, spelling, and style.
 *
 * - enhanceWriting - A function that analyzes text and provides corrections and suggestions.
 */

import { ai } from '@/ai/genkit';
import {
  EnhanceWritingInputSchema,
  EnhanceWritingOutputSchema,
  type EnhanceWritingInput,
  type EnhanceWritingOutput
} from './enhance-writing.types';

import { callLocalAI, extractJSON } from '../local-ai';

export async function enhanceWriting(input: EnhanceWritingInput): Promise<EnhanceWritingOutput> {
    const prompt = `<|im_start|>system
You are an expert writing assistant. Correct the spelling and grammar, and provide stylistic suggestions.
Text: ${input.text}

You MUST output ONLY a valid JSON object:
{
  "correctedText": "The fully corrected text here...",
  "suggestions": [
    {
      "original": "snippet",
      "suggestion": "improvement",
      "explanation": "why?"
    }
  ]
}
Output only the JSON.<|im_end|>
<|im_start|>assistant
{`;

    const response = await callLocalAI(prompt);
    return extractJSON(response);
}
