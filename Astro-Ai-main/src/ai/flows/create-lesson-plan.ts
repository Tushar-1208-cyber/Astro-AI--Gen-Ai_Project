
'use server';

import { generate } from '@genkit-ai/ai';
import { gemini20Flash } from '@genkit-ai/googleai';
import { callLocalAI, extractJSON } from '../local-ai';
import {
    CreateLessonPlanOutputSchema,
    type CreateLessonPlanInput,
    type CreateLessonPlanOutput
} from './create-lesson-plan.types';

export async function createLessonPlan(input: CreateLessonPlanInput): Promise<CreateLessonPlanOutput> {
    const targetLang = input.language || 'English';
    const promptString = `You are an expert curriculum designer. 
Task: Create a comprehensive lesson plan for:
Topic: ${input.topic}
Grade Level: ${input.gradeLevel}
Duration: ${input.durationInMinutes} mins
Objectives: ${input.learningObjectives.join(', ')}
Language: ${targetLang}

STRICT RULE: All content (title, objectives, materials, activity descriptions) MUST be in ${targetLang}.

Return as a structured JSON object.`;

    let retries = 3;
    while (retries > 0) {
        try {
            console.log(`📡 Calling Gemini for Lesson Plan: ${input.topic}...`);
            const response = await generate({
                model: gemini20Flash,
                prompt: promptString,
                output: { schema: CreateLessonPlanOutputSchema },
                config: { temperature: 0.7 }
            });
            
            const output = response.output();
            if (output) {
                console.log("✅ Gemini generated the lesson plan!");
                return output;
            }
            throw new Error("Empty output from Gemini");
        } catch (error: any) {
            console.error(`❌ Gemini Error (Lesson Plan): ${error.message}. Retries left: ${retries - 1}`);
            retries--;
            if (retries > 0) await new Promise(r => setTimeout(r, 2000));
        }
    }

    // Fallback to Local AI (Ollama/Llama3)
    console.log("⚠️ Falling back to Local AI for Lesson Plan...");
    const localPrompt = `Task: Create a lesson plan for ${input.topic} (Grade ${input.gradeLevel}, ${input.durationInMinutes} min).
Return ONLY a JSON object with:
"title": "...",
"objectives": ["...", "..."],
"materials": ["...", "..."],
"activities": [{"name": "...", "description": "...", "duration": 10}]
Language: ${targetLang}
JSON:`;

    const response = await callLocalAI(localPrompt);
    return extractJSON(response);
}
