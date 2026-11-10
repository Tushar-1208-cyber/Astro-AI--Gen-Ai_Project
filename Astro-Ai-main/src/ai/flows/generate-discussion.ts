'use server';

import { executeStructuredGeneration } from '../provider';
import {
    GenerateDiscussionOutputSchema,
    type GenerateDiscussionInput,
    type GenerateDiscussionOutput
} from './generate-discussion.types';

export async function generateDiscussion(input: GenerateDiscussionInput): Promise<GenerateDiscussionOutput> {
    const targetLang = input.language || 'English';
    const prompt = `You are an expert educator.
Task: Generate engaging discussion materials for:
Topic: ${input.topic}
Grade: ${input.gradeLevel}
Language: ${targetLang}

STRICT RULE: All content (questions, vocabulary definitions, viewpoints) MUST be in ${targetLang}.

Provide:
1. 5 open-ended discussion questions.
2. 5 key vocabulary words with definitions.
3. 3 different viewpoints or perspectives on the topic.

Return as a structured JSON object matching this schema:
{
  "discussionQuestions": ["string"],
  "vocabulary": [{"word": "string", "definition": "string"}],
  "viewpoints": [{"title": "string", "summary": "string"}]
}`;

    return await executeStructuredGeneration<GenerateDiscussionOutput>({
        prompt,
        schema: GenerateDiscussionOutputSchema,
        maxTokens: 1500,
        temperature: 0.7
    });
}
