'use server';

import { executeStructuredGeneration } from '../provider';
import {
  EnhanceWritingOutputSchema,
  type EnhanceWritingInput,
  type EnhanceWritingOutput
} from './enhance-writing.types';

export async function enhanceWriting(input: EnhanceWritingInput): Promise<EnhanceWritingOutput> {
    const prompt = `You are an expert writing assistant. Correct the spelling and grammar, and provide stylistic suggestions.
Text: ${input.text}

You MUST output ONLY a valid JSON object matching this schema:
{
  "correctedText": "The fully corrected text here...",
  "suggestions": [
    {
      "original": "snippet",
      "suggestion": "improvement",
      "explanation": "why?"
    }
  ]
}`;

    return await executeStructuredGeneration<EnhanceWritingOutput>({
        prompt,
        schema: EnhanceWritingOutputSchema,
        maxTokens: 1500,
        temperature: 0.3
    });
}
