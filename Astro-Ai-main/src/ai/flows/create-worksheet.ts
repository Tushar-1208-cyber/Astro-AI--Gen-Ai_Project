'use server';

import { executeStructuredGeneration } from '../provider';
import type { CreateWorksheetInput, CreateWorksheetOutput } from './create-worksheet.types';

export async function createWorksheet(input: CreateWorksheetInput): Promise<CreateWorksheetOutput> {
    const prompt = `You are an expert instructional designer. Create a high-quality educational worksheet for Grade ${input.gradeLevel} about: ${input.topic}.
Include exactly ${input.numQuestions} diverse and challenging questions.

EXAMPLE FORMAT:
{
  "title": "The Wonders of Photosynthesis",
  "questions": [
    {
      "question": "Which gas do plants absorb from the atmosphere?",
      "type": "multiple-choice", 
      "options": ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"],
      "answer": "Carbon Dioxide"
    }
  ]
}

Return ONLY the JSON object. Use types: 'multiple-choice', 'true-false', 'short-answer', 'fill-in-the-blank'.`;

    const rawOutput = await executeStructuredGeneration<any>({
        prompt,
        maxTokens: 1500,
        temperature: 0.7
    });

    if (!rawOutput || !rawOutput.questions || !Array.isArray(rawOutput.questions)) {
        throw new Error("AI generation failed to produce worksheet questions. Please check local AI server status or try again with a more specific topic.");
    }

    // Validate generated questions (No silent mock fallbacks)
    const validQuestions = rawOutput.questions
        .filter((q: any) => q && typeof q.question === 'string' && q.question.trim().length > 5)
        .map((q: any) => {
            const sanitizedType = q.type || (Array.isArray(q.options) && q.options.length > 0 ? "multiple-choice" : "short-answer");
            return {
                question: q.question.trim(),
                type: sanitizedType,
                options: Array.isArray(q.options) ? q.options.filter((o: any) => typeof o === 'string' && o.trim().length > 0) : [],
                answer: typeof q.answer === 'string' ? q.answer.trim() : ""
            };
        });

    if (validQuestions.length === 0) {
        throw new Error("AI output contained malformed questions. Please retry generation.");
    }

    return {
        title: rawOutput.title?.trim() || `${input.topic} Worksheet`,
        questions: validQuestions.slice(0, input.numQuestions)
    };
}
