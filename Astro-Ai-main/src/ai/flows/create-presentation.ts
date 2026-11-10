'use server';

import { executeStructuredGeneration } from '../provider';
import type { CreatePresentationInput, CreatePresentationOutput } from './create-presentation.types';

export async function createPresentation(input: CreatePresentationInput): Promise<CreatePresentationOutput> {
    const prompt = `You are a professional educational presentation designer.
Create a presentation about "${input.topic}" with ${input.numSlides} slides.
${input.additionalInstructions ? `Additional context: ${input.additionalInstructions}` : ''}

Return ONLY a valid JSON object matching this structure:
{
  "title": "Presentation Title",
  "slides": [
    {
      "title": "Slide Title",
      "content": ["Point 1", "Point 2", "Point 3"],
      "speakerNotes": "Notes for the teacher",
      "visualSuggestion": "Visual suggestion description"
    }
  ]
}`;

    const raw = await executeStructuredGeneration<any>({
        prompt,
        maxTokens: 2048,
        temperature: 0.7
    });

    if (!raw || !raw.slides || !Array.isArray(raw.slides)) {
        throw new Error("AI generation failed to produce valid presentation slides.");
    }

    const validSlides = raw.slides
        .filter((s: any) => s && typeof s.title === 'string' && s.title.trim().length > 0)
        .map((s: any) => {
            const contentItems = (Array.isArray(s.content) ? s.content : (s.content ? [s.content] : []))
                .filter((c: any) => typeof c === 'string' && c.trim().length > 0)
                .map((c: any) => c.trim());
            return {
                title: s.title.trim(),
                content: contentItems,
                speakerNotes: typeof s.speakerNotes === 'string' ? s.speakerNotes.trim() : '',
                imageDataUri: ''
            };
        })
        .filter((s: any) => s.content.length > 0);

    if (validSlides.length === 0) {
        throw new Error("AI generation produced malformed or empty presentation slides. Please retry generation.");
    }

    return {
        title: typeof raw.title === 'string' && raw.title.trim().length > 0 ? raw.title.trim() : input.topic,
        slides: validSlides
    };
}
