'use server';

/**
 * @fileOverview An AI agent that recognizes students from a class photo.
 *
 * - recognizeStudents - A function that identifies students in an image.
 */

import { ai } from '@/ai/genkit';
import { assertCapability } from '../provider';
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
  assertCapability('multimodal-vision');

  if (!input.photoDataUri || input.photoDataUri.trim().length < 10) {
    throw new Error("Invalid or empty photo data provided for student facial recognition.");
  }

  let retries = 2;
  while (retries > 0) {
    try {
      const { output } = await prompt(input);
      if (output && Array.isArray(output.presentStudents)) {
        return RecognizeStudentsOutputSchema.parse(output);
      }
      throw new Error("No output returned from recognition model.");
    } catch (error: any) {
      if (error.name === 'UnsupportedCapabilityError') {
        throw error;
      }
      if (error.message?.includes('429') || error.message?.includes('quota')) {
        console.log(`⚠️ Attendance Quota hit. Waiting 5s... (Attempts left: ${retries})`);
        await new Promise(r => setTimeout(r, 5000));
        retries--;
      } else {
        throw error;
      }
    }
  }

  throw new Error("Automated facial recognition was unable to identify students from the provided photo. Please take roll call manually or retry with a clearer photo.");
}
