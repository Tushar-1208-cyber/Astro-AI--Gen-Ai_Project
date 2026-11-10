'use server';

import { executeStructuredGeneration } from '../provider';
import {
    CreateLessonPlanOutputSchema,
    type CreateLessonPlanInput,
    type CreateLessonPlanOutput
} from './create-lesson-plan.types';

export async function createLessonPlan(input: CreateLessonPlanInput): Promise<CreateLessonPlanOutput> {
    const targetLang = input.language || 'English';
    const prompt = `You are an expert curriculum designer. 
Task: Create a comprehensive lesson plan for:
Topic: ${input.topic}
Grade Level: ${input.gradeLevel}
Duration: ${input.durationInMinutes} mins
Objectives: ${input.learningObjectives.join(', ')}
Language: ${targetLang}

STRICT RULE: All content (title, objectives, materials, activity descriptions) MUST be in ${targetLang}.

Return as a structured JSON object matching this schema:
{
  "title": "string",
  "objectives": ["string"],
  "materials": ["string"],
  "activities": [{"name": "string", "description": "string", "duration": 10}]
}`;

    return await executeStructuredGeneration<CreateLessonPlanOutput>({
        prompt,
        schema: CreateLessonPlanOutputSchema,
        maxTokens: 1500,
        temperature: 0.7
    });
}
