'use server';

import { ai } from '@/ai/genkit';
import { GenerateVideoInputSchema, GenerateVideoOutputSchema, type GenerateVideoInput, type GenerateVideoOutput } from './generate-video.types';
import { assertCapability } from '../provider';

export const generateVideoFlow = ai.defineFlow(
  {
    name: 'generate-video',
    inputSchema: GenerateVideoInputSchema,
    outputSchema: GenerateVideoOutputSchema,
  },
  async (input: GenerateVideoInput): Promise<GenerateVideoOutput> => {
    // 1. Strictly gate on centralized capability matrix
    assertCapability('video-generation');

    // 2. Future-proof placeholder for enterprise video preview
    throw new Error(
      'Video generation (Veo 3.1) is currently restricted to private enterprise preview on Google Cloud and is not available via standard API keys.'
    );
  }
);

export async function generateVideoFlowAction(input: GenerateVideoInput) {
  try {
    const result = await generateVideoFlow(input);
    return { success: result.status === 'completed', data: result, error: result.error };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
