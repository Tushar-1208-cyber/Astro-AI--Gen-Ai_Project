'use server';

import { executeStructuredGeneration } from '../provider';

export type CreateRubricInput = { assignmentDescription: string; criteria: string[] };
export type CreateRubricOutput = { 
    title: string; 
    criteria: Array<{ 
        name: string; 
        levels: Array<{ level: string; description: string }> 
    }> 
};

export async function createRubric(input: CreateRubricInput): Promise<CreateRubricOutput> {
    const prompt = `You are a professional teacher. Create a detailed grading rubric for:
Assignment: ${input.assignmentDescription}
Criteria: ${input.criteria.join(', ')}

Return ONLY a valid JSON object.
Example Structure:
{
  "title": "Rubric Title",
  "criteria": [
    {
      "name": "Criterion Name",
      "levels": [
        { "level": "Excellent", "description": "Specific high-standard description." },
        { "level": "Good", "description": "Specific standard description." },
        { "level": "Needs Improvement", "description": "Specific deficiency description." }
      ]
    }
  ]
}`;

    const rawOutput = await executeStructuredGeneration<any>({
        prompt,
        maxTokens: 1500,
        temperature: 0.7
    });

    if (!rawOutput || !rawOutput.criteria || !Array.isArray(rawOutput.criteria)) {
        throw new Error("AI generation failed to produce valid rubric criteria. Please verify local AI server is active.");
    }

    // Validate real criteria without injecting artificial mock text
    const validatedCriteria = rawOutput.criteria
        .filter((c: any) => c && typeof c.name === 'string' && c.name.trim().length > 0)
        .map((c: any) => {
            const validLevels = (Array.isArray(c.levels) ? c.levels : [])
                .filter((l: any) => l && typeof l.level === 'string' && typeof l.description === 'string' && l.description.trim().length > 3)
                .map((l: any) => ({
                    level: l.level.trim(),
                    description: l.description.trim()
                }));
            return {
                name: c.name.trim(),
                levels: validLevels
            };
        })
        .filter((c: any) => c.levels.length > 0);

    if (validatedCriteria.length === 0) {
        throw new Error("AI rubric generation produced malformed criteria levels. Please retry generation.");
    }

    return {
        title: rawOutput.title?.trim() || `Grading Rubric for ${input.assignmentDescription.substring(0, 30)}`,
        criteria: validatedCriteria
    };
}
