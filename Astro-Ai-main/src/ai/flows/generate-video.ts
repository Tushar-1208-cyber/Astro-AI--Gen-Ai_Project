'use server';

import {ai} from '@/ai/genkit';
import { GenerateVideoInputSchema, GenerateVideoOutputSchema, type GenerateVideoInput, type GenerateVideoOutput } from './generate-video.types';
import { callLocalAI, extractJSON } from '../local-ai';

export const generateVideoFlow = ai.defineFlow(
  {
    name: 'generate-video',
    inputSchema: GenerateVideoInputSchema,
    outputSchema: GenerateVideoOutputSchema,
  },
  async (input: GenerateVideoInput): Promise<GenerateVideoOutput> => {
    const GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
    
    try {
      if (!input.prompt.trim()) throw new Error('Video prompt is required');
      if (!GEMINI_API_KEY) throw new Error('Google AI API key not configured');

      // 1. Generate video script using Local GPU
      const scriptPrompt = `Generate a video script for: ${input.prompt}. Duration: ${input.duration}s. Style: ${input.style}. Return JSON.`;
      const scriptResponse = await callLocalAI(scriptPrompt);
      const scriptResult = extractJSON(scriptResponse);
      
      const videoId = `veo31_${Date.now()}`;
      
      // 2. Call Veo 3.1 API (Correct REST Format for Google AI Studio)
      console.log(`🎬 Calling Veo 3.1 for: ${input.prompt}...`);
      const VEO_URL = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:generateContent?key=${GEMINI_API_KEY}`;
      
      const veoResponse = await fetch(VEO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Create a ${input.duration}s video. Prompt: ${input.prompt}. Style: ${input.style}. Script: ${scriptResult.videoScript || input.prompt}`
            }]
          }],
          generationConfig: { temperature: 0.7 }
        }),
        cache: 'no-store'
      });
      
      if (!veoResponse.ok) {
        const errorText = await veoResponse.text();
        throw new Error(`Veo 3.1 Error: ${veoResponse.status} - ${errorText}`);
      }
      
      const veoData = await veoResponse.json();
      
      // Extract video URL or data
      let videoUrl = '';
      const part = veoData.candidates?.[0]?.content?.parts?.[0];
      if (part?.inlineData) {
        videoUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      } else if (part?.text) {
        const urlMatch = part.text.match(/https?:\/\/[^\s]+\.(mp4|webm)/i);
        if (urlMatch) videoUrl = urlMatch[0];
      }
      
      if (!videoUrl) throw new Error('No video generated. Veo 3.1 might be in preview mode.');
      
      return {
        videoUrl,
        videoId,
        prompt: input.prompt,
        duration: input.duration,
        aspectRatio: input.aspectRatio,
        style: input.style,
        quality: input.quality,
        status: 'completed',
      };
    } catch (error: any) {
      console.error('Video generation error:', error);
      return {
        videoUrl: '',
        videoId: '',
        prompt: input.prompt,
        duration: input.duration,
        aspectRatio: input.aspectRatio,
        style: input.style,
        quality: input.quality,
        status: 'failed',
        error: error.message,
      };
    }
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