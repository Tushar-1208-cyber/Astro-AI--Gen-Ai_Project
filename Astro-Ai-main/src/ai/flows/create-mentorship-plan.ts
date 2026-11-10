'use server';

import { executeStructuredGeneration } from '../provider';
import {
    CreateMentorshipPlanOutputSchema,
    type CreateMentorshipPlanInput,
    type CreateMentorshipPlanOutput
} from './create-mentorship-plan.types';

export async function createMentorshipPlan(input: CreateMentorshipPlanInput): Promise<CreateMentorshipPlanOutput> {
    const targetLang = input.language || 'English';
    const prompt = `You are an expert educational psychologist and student mentor.
Task: Create a personalized mentorship plan for:
Student: ${input.studentName}
Grade Level: ${input.gradeLevel}
Language: ${targetLang}

Student Performance Context:
- Average Grade: ${input.gradeAnalysis.averageGrade}%
- Strengths: ${input.gradeAnalysis.subjectStrengths.join(', ')}
- Weaknesses: ${input.gradeAnalysis.subjectWeaknesses.join(', ')}
- Grade Trend: ${input.gradeAnalysis.gradeTrend}

Teacher Observed Challenges:
${input.problems.join('\n')}

Student's Recent Strengths:
${input.progress}

STRICT RULE: All content (planTitle, goals, suggestedActivities, progressCheck) MUST be in ${targetLang}.
Return ONLY valid JSON matching this schema:
{
  "planTitle": "string",
  "goals": ["string"],
  "suggestedActivities": [{"name": "string", "description": "string"}],
  "progressCheck": "string"
}`;

    return await executeStructuredGeneration<CreateMentorshipPlanOutput>({
        prompt,
        schema: CreateMentorshipPlanOutputSchema,
        maxTokens: 1500,
        temperature: 0.7
    });
}
