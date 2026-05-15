
'use server';

export async function photoToWorksheet(input: { photoDataUri: string, language?: string }): Promise<{ worksheet: string }> {
  const GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
  const targetLang = input.language || 'English';
  
  console.log("📡 [Vision] Starting High-Speed AI Analysis...");

  try {
    // Extract base64 data and mime type
    const base64Data = input.photoDataUri.split(',')[1];
    const mimeType = input.photoDataUri.split(',')[0].split(':')[1].split(';')[0];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `TASK: Act as an expert teacher. Analyze this textbook page and create a comprehensive interactive worksheet in ${targetLang}. 
                     Include a creative Title, a brief Summary of the content, and 5-8 diverse questions (MCQs, True/False, and Short Answers).
                     Make it engaging for students. Return ONLY the worksheet text in a clean format.` },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            }
          ]
        }]
      }),
      cache: 'no-store'
    });

    const data = await response.json();
    
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.log("✅ [Vision] Analysis Complete!");
      return {
        worksheet: data.candidates[0].content.parts[0].text
      };
    } else {
      console.error("❌ [Vision] API Error:", JSON.stringify(data));
      throw new Error(data.error?.message || "AI failed to read the image.");
    }
  } catch (error: any) {
    console.error("❌ [Vision] Error:", error.message);
    throw new Error(`Astro Vision Error: ${error.message}`);
  }
}
