/**
 * @fileOverview Type definitions for the ask-astro flow.
 */
import { z } from 'genkit';

export const AskAstroInputSchema = z.object({
  question: z.string().describe('The question or concept to explain.'),
  gradeLevel: z.number().describe('The target grade level for the explanation.'),
  language: z.string().describe('The ISO 639-1 code for the language of the explanation.'),
});
export type AskAstroInput = z.infer<typeof AskAstroInputSchema>;

export const AskAstroOutputSchema = z.object({
  answer: z.string().describe('The simplified, kid-friendly explanation.'),
});
export type AskAstroOutput = z.infer<typeof AskAstroOutputSchema>;
