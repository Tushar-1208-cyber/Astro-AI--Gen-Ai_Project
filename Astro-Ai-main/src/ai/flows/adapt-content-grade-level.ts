'use server';

import { executeTextGeneration } from '../provider';

export type AdaptContentGradeLevelInput = { content: string; gradeLevel: number };

export async function adaptContentGradeLevel(input: AdaptContentGradeLevelInput): Promise<{ adaptedContent: string }> {
    const safeContent = input.content.substring(0, 1500);

    const prompt = `You are an expert pedagogical editor. 
TASK: Adapt the following content to be age-appropriate and easy to understand for Grade ${input.gradeLevel} students.
CONTENT: ${safeContent}

Maintain the core message but simplify the vocabulary and sentence structure. 
Return ONLY the adapted text.`;

    const adapted = await executeTextGeneration({
        prompt,
        maxTokens: 800,
        temperature: 0.7,
        capability: 'text-generation'
    });

    return { adaptedContent: adapted.trim() };
}
