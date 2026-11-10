'use server';

import { ai } from '../genkit';
import { assertCapability } from '../provider';

export type PhotoToWorksheetInput = { photoDataUri: string; language?: string };

export async function photoToWorksheet(input: PhotoToWorksheetInput): Promise<{ worksheet: string }> {
  assertCapability('multimodal-vision');
  const targetLang = input.language || 'English';

  console.log("📡 [Vision] Starting AI Multimodal Analysis via Genkit...");

  try {
    const promptText = `TASK: Act as an expert teacher. Analyze this textbook page and create a comprehensive interactive worksheet in ${targetLang}. 
Include a creative Title, a brief Summary of the content, and 5-8 diverse questions (MCQs, True/False, and Short Answers).
Make it engaging for students. Return ONLY the worksheet text in a clean format.`;

    const response = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      prompt: [
        { text: promptText },
        { media: { url: input.photoDataUri } }
      ]
    });

    const worksheet = response.text;
    if (!worksheet || worksheet.trim().length === 0) {
      throw new Error("AI vision model returned an empty worksheet.");
    }

    return { worksheet: worksheet.trim() };
  } catch (error: any) {
    console.error("❌ [Vision] Error:", error.message);
    throw new Error(`Astro Vision Error: ${error.message}`);
  }
}
