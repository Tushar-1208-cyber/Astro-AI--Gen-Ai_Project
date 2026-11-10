'use server';

import { executeStructuredGeneration } from '../provider';
import {
  ProfessionalDevelopmentOutputSchema,
  type ProfessionalDevelopmentInput,
  type ProfessionalDevelopmentOutput
} from './teacher-pd.types';

export async function getProfessionalDevelopmentPlan(input: ProfessionalDevelopmentInput): Promise<ProfessionalDevelopmentOutput> {
    const prompt = `You are an expert instructional coach. Create a professional development plan for a teacher with this goal: ${input.learningGoal}.
    
Return ONLY a JSON object matching this schema:
{
  "planTitle": "Detailed Growth Plan Title",
  "keyConcepts": ["Expert Concept 1", "Expert Concept 2"],
  "suggestedSteps": [
    {
      "title": "Actionable Step Title",
      "description": "Deep pedagogical explanation.",
      "strategies": ["Specific strategy 1", "Specific strategy 2"],
      "youtubeSearchQuery": "precise keywords"
    }
  ]
}`;

    return await executeStructuredGeneration<ProfessionalDevelopmentOutput>({
        prompt,
        schema: ProfessionalDevelopmentOutputSchema,
        maxTokens: 1500,
        temperature: 0.7
    });
}
