
'use server';

/**
 * @fileOverview Generates a visual aid image from a text prompt.
 * Using Pollinations.ai for reliable, free, and fast image generation.
 */

import {
    type GenerateVisualAidInput,
    type GenerateVisualAidOutput
} from './generate-visual-aid.types';

export async function generateVisualAid(input: GenerateVisualAidInput): Promise<GenerateVisualAidOutput> {
    try {
        // We refine the prompt to ensure a "Blackboard Style" educational drawing
        const refinedPrompt = encodeURIComponent(
            `A professional, simple blackboard-style educational line drawing of ${input.prompt}. 
             Black background, white chalk lines, clear labels, minimal detail, high contrast.`
        );

        // Pollinations.ai is a reliable free API for image generation
        const imageUrl = `https://image.pollinations.ai/prompt/${refinedPrompt}?width=1024&height=1024&nologo=true&enhance=false&seed=${Math.floor(Math.random() * 1000000)}`;

        // We fetch the image to ensure it exists and convert to Base64 for consistent UI handling
        // (Optional: You could just return the URL, but Base64 is safer for local downloads)
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error("Failed to generate image from provider.");
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;

        return {
            imageDataUri: base64Image,
        };
    } catch (error: any) {
        console.error("❌ Image Generation Error:", error);
        throw new Error("Image service is currently unavailable. Please try again.");
    }
}
