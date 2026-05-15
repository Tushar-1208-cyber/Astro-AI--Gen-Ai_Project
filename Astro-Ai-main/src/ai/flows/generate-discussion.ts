
'use server';

import { generate } from '@genkit-ai/ai';
import { gemini20Flash } from '@genkit-ai/googleai';
import { callLocalAI, extractJSON } from '../local-ai';
import {
    GenerateDiscussionOutputSchema,
    type GenerateDiscussionInput,
    type GenerateDiscussionOutput
} from './generate-discussion.types';

export async function generateDiscussion(input: GenerateDiscussionInput): Promise<GenerateDiscussionOutput> {
    const targetLang = input.language || 'English';
    const promptString = `You are an expert educator.
Task: Generate engaging discussion materials for:
Topic: ${input.topic}
Grade: ${input.gradeLevel}
Language: ${targetLang}

STRICT RULE: All content (questions, vocabulary definitions, viewpoints) MUST be in ${targetLang}.

Provide:
1. 5 open-ended discussion questions.
2. 5 key vocabulary words with definitions.
3. 3 different viewpoints or perspectives on the topic.

Return as a structured JSON object.`;

    let retries = 3;
    while (retries > 0) {
        try {
            console.log(`📡 Calling Gemini for Discussion: ${input.topic}...`);
            const response = await generate({
                model: gemini20Flash,
                prompt: promptString,
                output: { schema: GenerateDiscussionOutputSchema },
                config: { temperature: 0.7 }
            });
            
            const output = response.output();
            if (output) {
                console.log("✅ Gemini generated discussion materials!");
                return output;
            }
            throw new Error("Empty output from Gemini");
        } catch (error: any) {
            console.error(`❌ Gemini Error (Discussion): ${error.message}. Retries left: ${retries - 1}`);
            retries--;
            if (retries > 0) await new Promise(r => setTimeout(r, 2000));
        }
    }

    // Fallback to Local AI (Ollama/Llama3)
    console.log("⚠️ Falling back to Local AI for Discussion...");
    const localPrompt = `Task: Generate discussion materials for ${input.topic} (Grade ${input.gradeLevel}).
Return ONLY a JSON object with:
"discussionQuestions": ["...", "..."],
"vocabulary": [{"word": "...", "definition": "..."}],
"viewpoints": [{"title": "...", "summary": "..."}]
JSON:`;

    const response = await callLocalAI(localPrompt);
    return extractJSON(response);
}
