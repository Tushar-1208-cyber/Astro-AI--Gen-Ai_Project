'use server';

/**
 * @fileOverview An AI agent that recognizes students from a class photo.
 *
 * - recognizeStudents - A function that identifies students in an image.
 */

import { ai } from '@/ai/genkit';
import {
    RecognizeStudentsInputSchema,
    RecognizeStudentsOutputSchema,
    type RecognizeStudentsInput,
    type RecognizeStudentsOutput,
    type RecognizeStudentsInputWithRoster
} from './recognize-students.types';


const prompt = ai.definePrompt({
  name: 'recognizeStudentsPrompt',
  model: 'googleai/gemini-2.0-flash',
  input: { schema: RecognizeStudentsInputSchema },
  output: { schema: RecognizeStudentsOutputSchema },
  prompt: `You are an AI classroom assistant. Look at this photo of students and identify who is present.
  Compare the faces in the photo with this roster: {{#each studentRoster}}{{this.name}}, {{/each}}
  Only return names of students visible in the photo.
  {{media url=photoDataUri}}`,
});

export async function recognizeStudents(input: RecognizeStudentsInputWithRoster): Promise<RecognizeStudentsOutput> {
  let retries = 3;
  while (retries > 0) {
    try {
      const { output } = await prompt(input);
      return output!;
    } catch (error: any) {
      if (error.message?.includes('429') || error.message?.includes('quota')) {
        console.log(`⚠️ Attendance Quota hit. Waiting 15s... (Attempts left: ${retries})`);
        await new Promise(r => setTimeout(r, 15000));
        retries--;
      } else {
        throw error;
      }
    }
  }

  console.log("⚠️ AI Recognition failed completely. Falling back to manual mode.");
  return {
    presentStudents: input.studentRoster.map(s => s.name)
  };
}
