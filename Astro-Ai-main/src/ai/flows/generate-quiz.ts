'use server';

import { executeStructuredGeneration } from '../provider';

export type GenerateQuizInput = { topic: string; quizType: string; numQuestions: number };

export interface GenerateQuizOutput {
  title: string;
  quizType: string;
  questions: Array<{
    question: string;
    answer: string;
    options?: string[];
  }>;
}

export async function generateQuiz(input: GenerateQuizInput): Promise<GenerateQuizOutput> {
  const prompt = `Create a ${input.quizType} quiz about "${input.topic}" with ${input.numQuestions} questions. Return ONLY JSON with format:
  {
    "title": "Quiz Title",
    "questions": [
      {
        "question": "Question text",
        "options": ["Choice 1", "Choice 2", "Choice 3", "Choice 4"],
        "answer": "Choice 1"
      }
    ]
  }`;

  const raw = await executeStructuredGeneration<any>({
    prompt,
    maxTokens: 1500,
    temperature: 0.7
  });

  if (!raw || !raw.questions || !Array.isArray(raw.questions)) {
    throw new Error("AI generation failed to produce valid quiz questions.");
  }

  const validQuestions = raw.questions
    .filter((q: any) => q && typeof q.question === 'string' && q.question.trim().length > 3)
    .map((q: any) => {
      const options = Array.isArray(q.options)
        ? q.options.filter((o: any) => typeof o === 'string' && o.trim().length > 0).map((o: any) => o.trim())
        : [];
      const answer = typeof q.answer === 'string' && q.answer.trim().length > 0
        ? q.answer.trim()
        : (options.length > 0 ? options[0] : '');
      return {
        question: q.question.trim(),
        answer,
        options
      };
    })
    .filter((q: any) => q.question.length > 0 && (q.answer.length > 0 || q.options.length > 0));

  if (validQuestions.length === 0) {
    throw new Error("AI generation produced malformed or empty quiz questions. Please retry generation.");
  }

  return {
    title: typeof raw.title === 'string' && raw.title.trim().length > 0 ? raw.title.trim() : `${input.topic} Quiz`,
    quizType: input.quizType,
    questions: validQuestions
  };
}
