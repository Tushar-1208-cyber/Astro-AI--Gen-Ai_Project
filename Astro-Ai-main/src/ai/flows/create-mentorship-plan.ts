
'use server';

import { callLocalAI, extractJSON } from '../local-ai';
import {
    CreateMentorshipPlanOutputSchema,
    type CreateMentorshipPlanInput,
    type CreateMentorshipPlanOutput
} from './create-mentorship-plan.types';

export async function createMentorshipPlan(input: CreateMentorshipPlanInput): Promise<CreateMentorshipPlanOutput> {
    const GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY;
    const targetLang = input.language || 'English';
    const promptString = `You are an expert educational psychologist and student mentor.
    Task: Create a personalized mentorship plan for:
    Student: ${input.studentName}
    Grade Level: ${input.gradeLevel}
    Language: ${targetLang}
    
    Student Performance Context:
    - Average Grade: ${input.gradeAnalysis.averageGrade}%
    - Strengths: ${input.gradeAnalysis.subjectStrengths.join(', ')}
    - Weaknesses: ${input.gradeAnalysis.subjectWeaknesses.join(', ')}
    - Grade Trend: ${input.gradeAnalysis.gradeTrend}
    
    Teacher Observed Challenges:
    ${input.problems.join('\n')}
    
    Student's Recent Strengths:
    ${input.progress}
    
    STRICT RULE: All content (planTitle, goals, suggestedActivities, progressCheck) MUST be in ${targetLang}.
    Return ONLY valid JSON.`;

    // 1. Try Gemini REST (v1beta with gemini-2.0-flash)
    try {
        console.log(`📡 Calling Gemini REST for Mentorship Plan: ${input.studentName}...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptString }] }],
                generationConfig: { 
                    response_mime_type: "application/json",
                    temperature: 0.7 
                }
            }),
            cache: 'no-store'
        });

        const data = await response.json();
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            const rawOutput = JSON.parse(data.candidates[0].content.parts[0].text);
            console.log("✅ Gemini REST generated the mentorship plan!");
            return rawOutput;
        }
    } catch (error: any) {
        console.error(`❌ Gemini REST Error (Mentorship): ${error.message}`);
    }

    // 2. Fallback to Local AI
    console.log("⚠️ Falling back to Local AI for Mentorship Plan...");
    const localPrompt = `${promptString}\n\nReturn JSON:`;
    const response = await callLocalAI(localPrompt);
    return extractJSON(response);
}
