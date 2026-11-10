'use server';

import { executeStructuredGeneration } from '../provider';
import type { GenerateLocalizedContentInput } from './generate-localized-content.types';

export async function generateLocalizedContent(input: GenerateLocalizedContentInput): Promise<any> {
    const langList = input.languages.split(',').map((l: string) => l.trim());
    
    const prompt = `You are an expert multilingual educator. 
TASK: Generate a high-quality ${input.contentType} for Grade ${input.gradeLevel} about ${input.prompt}.
LANGUAGES: ${langList.join(', ')}

RULES:
1. Be factually accurate.
2. For "quiz", use this EXACT JSON structure for EACH language:
{
  "en": {
     "quiz": [
       { "question": "Actual Fact?", "a": "Choice 1", "b": "Choice 2", "c": "Choice 3", "d": "Choice 4", "answer": "Choice 1" }
     ]
  },
  "hi": { ... }
}
3. The "answer" MUST EXACTLY MATCH one of the strings in a, b, c, or d.
4. If not a quiz, return {"en": {"content": "..."}, "hi": {"content": "..."}}.
Return ONLY valid JSON.`;

    const result = await executeStructuredGeneration<any>({
        prompt,
        maxTokens: 1800,
        temperature: 0.3
    });

    if (!result || typeof result !== 'object') {
        throw new Error("AI failed to generate valid localized content.");
    }

    return result;
}
