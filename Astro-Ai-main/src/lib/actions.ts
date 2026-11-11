
"use server";

import {
  adaptContentGradeLevel,
} from "@/ai/flows/adapt-content-grade-level";
import type { AdaptContentGradeLevelInput } from "@/ai/flows/adapt-content-grade-level";
import {
  generateAnswerKeyQrCode,
} from "@/ai/flows/generate-answer-key-qr-code";
import type { GenerateAnswerKeyQrCodeInput } from "@/ai/flows/generate-answer-key-qr-code";
import {
  generateLocalizedContent,
} from "@/ai/flows/generate-localized-content";
import type { GenerateLocalizedContentInput } from "@/ai/flows/generate-localized-content.types";
import {
  photoToWorksheet,
} from "@/ai/flows/photo-to-worksheet";
import type { PhotoToWorksheetInput } from "@/ai/flows/photo-to-worksheet";
import {
  generateQuiz,
} from "@/ai/flows/generate-quiz";
import type { GenerateQuizInput } from "@/ai/flows/generate-quiz";
import {
  createRubric,
} from "@/ai/flows/create-rubric";
import type { CreateRubricInput } from "@/ai/flows/create-rubric";
import {
  textToSpeech,
} from "@/ai/flows/text-to-speech";
import type { TextToSpeechInput } from "@/ai/flows/text-to-speech";
import {
  enhanceWriting,
} from "@/ai/flows/enhance-writing";
import type { EnhanceWritingInput } from "@/ai/flows/enhance-writing.types";
import {
  recognizeStudents,
} from "@/ai/flows/recognize-students";
import type { RecognizeStudentsInputWithRoster } from "@/ai/flows/recognize-students.types";
import {
  createLessonPlan,
} from "@/ai/flows/create-lesson-plan";
import type { CreateLessonPlanInput } from "@/ai/flows/create-lesson-plan.types";
import {
  generateDiscussion
} from "@/ai/flows/generate-discussion";
import type { GenerateDiscussionInput } from "@/ai/flows/generate-discussion.types";
import {
  generateVisualAid
} from "@/ai/flows/generate-visual-aid";
import type { GenerateVisualAidInput } from "@/ai/flows/generate-visual-aid.types";
import {
  askAstro
} from "@/ai/flows/ask-astro";
import type { AskAstroInput } from "@/ai/flows/ask-astro.types";
import {
  getTtsVoices
} from "@/ai/flows/get-tts-voices";
import {
  createPresentation
} from "@/ai/flows/create-presentation";
import type { CreatePresentationInput } from "@/ai/flows/create-presentation.types";
import {
  getProfessionalDevelopmentPlan
} from "@/ai/flows/teacher-pd";
import type { ProfessionalDevelopmentInput } from "@/ai/flows/teacher-pd.types";
import {
  appChatbot
} from "@/ai/flows/app-chatbot";
import type { AppChatbotInput } from "@/ai/flows/app-chatbot.types";
import {
  createWorksheet,
} from "@/ai/flows/create-worksheet";
import type { CreateWorksheetInput } from "@/ai/flows/create-worksheet.types";
import { searchYoutubeVideos } from "@/ai/flows/search-youtube-videos";
import type { SearchYoutubeVideosInput } from "@/ai/flows/search-youtube-videos.types";
import { createMentorshipPlan } from "@/ai/flows/create-mentorship-plan";
import type { CreateMentorshipPlanInput } from "@/ai/flows/create-mentorship-plan.types";

import { studentRosterDb, type Student, gradesDb, type GradeEntry, calendarDb, type CalendarEvent, recordingsDb, type ClassRecording, attendanceDb } from "@/lib/firestore";
import { generateVideoFlowAction } from "@/ai/flows/generate-video";
import { getAuthenticatedUser } from "./auth";
import { sanitizeErrorMessage } from "./security";
import { dashboardRepo, attendanceRepo } from "./db-repo";


// Wrapper function to handle Genkit flow execution and error handling
async function runAction<I, O>(action: (input: I) => Promise<O>, input: I): Promise<{ success: true, data: O } | { success: false, error: string }> {
    try {
        const result = await action(input);
        return { success: true, data: result };
    } catch (error) {
        console.error(error);
        const message = sanitizeErrorMessage(error);
        return { success: false, error: message };
    }
}


export async function adaptContentAction(input: AdaptContentGradeLevelInput) {
  return runAction(adaptContentGradeLevel, input);
}

export async function generateQrCodeAction(input: GenerateAnswerKeyQrCodeInput) {
  return runAction(generateAnswerKeyQrCode, input);
}

export async function generateLocalizedContentAction(
  input: GenerateLocalizedContentInput
) {
  return runAction(generateLocalizedContent, input);
}

export async function photoToWorksheetAction(
  input: PhotoToWorksheetInput & { manualText?: string }
): Promise<{ success: true; data: { worksheet: string } } | { success: false; error: string }> {
  if (input.manualText) {
    console.log("🦾 [Local AI] Generating worksheet from manual text...");
    const result = await runAction(askAstro, {
      question: `Create an interactive worksheet based on this text. Include a title and 5-7 questions (MCQ, True/False, Short Answer). Return the worksheet as a clear list of questions. TEXT: ${input.manualText}`,
      gradeLevel: 6,
      language: input.language || 'en'
    });
    if (!result.success) {
      return { success: false, error: result.error };
    }
    return { success: true, data: { worksheet: result.data.answer } };
  }
  return runAction(photoToWorksheet, input);
}

export async function generateQuizAction(input: GenerateQuizInput) {
  return runAction(generateQuiz, input);
}

export async function createRubricAction(input: CreateRubricInput) {
    return runAction(createRubric, input);
}

export async function textToSpeechAction(input: TextToSpeechInput) {
    return runAction(textToSpeech, input);
}

export async function enhanceWritingAction(input: EnhanceWritingInput) {
  return runAction(enhanceWriting, input);
}

export async function recognizeStudentsAction(input: {photoDataUri: string}) {  
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, error: "Authentication required. Please log in." };
  }
  
  const studentRoster = await studentRosterDb.getStudents(user.userId);
  const flowInput: RecognizeStudentsInputWithRoster = { ...input, studentRoster };

  const result = await runAction(recognizeStudents, flowInput);
  
  if (result.success && result.data && Array.isArray(result.data.presentStudents)) {
    try {
      // Validate AI recognition output against the teacher's authenticated roster
      // Discard any hallucinated or unknown names not in the teacher's roster
      const rosterNames = new Set(studentRoster.map(s => s.name.trim().toLowerCase()));
      const validNamesMap = new Map<string, string>();
      studentRoster.forEach(s => validNamesMap.set(s.name.trim().toLowerCase(), s.name.trim()));

      const validatedPresentStudents = Array.from(
        new Set(
          result.data.presentStudents
            .map(name => String(name || '').trim())
            .filter(trimmed => trimmed.length > 0 && rosterNames.has(trimmed.toLowerCase()))
            .map(trimmed => validNamesMap.get(trimmed.toLowerCase()) || trimmed)
        )
      );

      // Mutate result data to only return validated students from authenticated roster
      result.data.presentStudents = validatedPresentStudents;

      await attendanceRepo.addAttendance(user.userId, {
        date: new Date(),
        presentStudents: validatedPresentStudents,
        photoDataUri: input.photoDataUri,
        totalStudents: studentRoster.length,
      });
      console.log("✅ Validated attendance & Photo stored in database.");
    } catch (e) {
      console.error("❌ Failed to store attendance:", e);
    }
  }
  return result;
}

export async function submitAttendanceAction(presentStudents: string[], photoDataUri?: string) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { success: false, error: "Authentication required. Please log in." };
  }

  if (!Array.isArray(presentStudents)) {
    return { success: false, error: "Invalid attendance data: Expected an array of student identifiers." };
  }

  try {
    const validated = await attendanceRepo.validateAndNormalizeRoster(user.userId, presentStudents);
    await attendanceRepo.addAttendance(user.userId, {
      date: new Date(),
      presentStudents: validated.canonicalPresentStudents,
      photoDataUri: photoDataUri || "",
      totalStudents: validated.totalStudents,
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Failed to save attendance." };
  }
}

export async function createLessonPlanAction(input: CreateLessonPlanInput) {
  return runAction(createLessonPlan, input);
}

export async function generateDiscussionAction(input: GenerateDiscussionInput) {
  return runAction(generateDiscussion, input);
}

export async function generateVisualAidAction(input: GenerateVisualAidInput) {
    return runAction(generateVisualAid, input);
}

export async function askAstroAction(input: AskAstroInput) {
    return runAction(askAstro, input);
}

export async function getTtsVoicesAction(languageCode: string) {
    try {
        const result = await getTtsVoices(languageCode);
        return { success: true, data: result };
    } catch (error) {
        console.error(error);
        const message = sanitizeErrorMessage(error);
        return { success: false, error: message };
    }
}

export async function createPresentationAction(input: CreatePresentationInput) {
    return runAction(createPresentation, input);
}

export async function professionalDevelopmentAction(input: ProfessionalDevelopmentInput) {
    return runAction(getProfessionalDevelopmentPlan, input);
}

export async function appChatbotAction(input: AppChatbotInput) {
    const enrichedInput = { ...input, studentRoster: [] };
    return runAction(appChatbot, enrichedInput);
}

export async function createWorksheetAction(input: CreateWorksheetInput) {
  return runAction(createWorksheet, input);
}

export async function searchYoutubeVideosAction(input: SearchYoutubeVideosInput) {
  return runAction(searchYoutubeVideos, input);
}

export async function createMentorshipPlanAction(input: CreateMentorshipPlanInput) {
    return runAction(createMentorshipPlan, input);
}


// Student Roster Actions
export async function getStudentsAction() {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: "Authentication required. Please log in." };
    }
    try {
        const students = await studentRosterDb.getStudents(user.userId);
        return { success: true, data: students };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to get students.";
        return { success: false, error: message };
    }
}

export async function addStudentAction(student: Omit<Student, 'id' | 'uid'>) {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: "Authentication required. Please log in." };
    }
    try {
        await studentRosterDb.addStudent(user.userId, student);
        const students = await studentRosterDb.getStudents(user.userId);
        return { success: true, data: students };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to add student.";
        return { success: false, error: message };
    }
}

export async function deleteStudentAction(id: string) {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: "Authentication required. Please log in." };
    }
    try {
        await studentRosterDb.deleteStudent(user.userId, id);
        const students = await studentRosterDb.getStudents(user.userId);
        return { success: true, data: students };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete student.";
        return { success: false, error: message };
    }
}


// Grade Tracking Actions
export async function getGradesAction() {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: "Authentication required. Please log in." };
    }
    try {
        const grades = await gradesDb.getGrades(user.userId);
        return { success: true, data: grades };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to get grades.";
        return { success: false, error: message };
    }
}

export async function addGradeAction(grade: Omit<GradeEntry, 'id' | 'uid'>) {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: "Authentication required. Please log in." };
    }
    try {
        await gradesDb.addGrade(user.userId, grade);
        const grades = await gradesDb.getGrades(user.userId);
        return { success: true, data: grades };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to add grade.";
        return { success: false, error: message };
    }
}

export async function deleteGradeAction(id: string) {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: "Authentication required. Please log in." };
    }
    try {
        await gradesDb.deleteGrade(user.userId, id);
        const grades = await gradesDb.getGrades(user.userId);
        return { success: true, data: grades };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete grade.";
        return { success: false, error: message };
    }
}

// Video Generation Actions
export async function generateVideoAction(input: {
  prompt: string;
  duration: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  style: "realistic" | "cinematic" | "animated" | "artistic";
  quality: "standard" | "high" | "ultra";
}) {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Authentication required. Please log in." };
  
  try {
    const result = await generateVideoFlowAction(input);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate video.";
    return { success: false, error: message };
  }
}

// Calendar Event Actions
export async function getCalendarEventsAction() {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: "Authentication required. Please log in." };
    }
    try {
        const events = await calendarDb.getEvents(user.userId);
        return { success: true, data: events };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to get events.";
        return { success: false, error: message };
    }
}

export async function addCalendarEventAction(event: Omit<CalendarEvent, 'id' | 'uid'>) {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: "Authentication required. Please log in." };
    }
    try {
        await calendarDb.addEvent(user.userId, event);
        const events = await calendarDb.getEvents(user.userId);
        return { success: true, data: events };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to add event.";
        return { success: false, error: message };
    }
}

export async function deleteCalendarEventAction(id: string) {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: "Authentication required. Please log in." };
    }
    try {
        await calendarDb.deleteEvent(user.userId, id);
        const events = await calendarDb.getEvents(user.userId);
        return { success: true, data: events };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete event.";
        return { success: false, error: message };
    }
}


// Class Recordings Actions
export async function getRecordingsAction() {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: "Authentication required. Please log in." };
    }
    try {
        const recordings = await recordingsDb.getRecordings(user.userId);
        return { success: true, data: recordings };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to get recordings.";
        return { success: false, error: message };
    }
}

export async function addRecordingAction(recording: Omit<ClassRecording, 'id' | 'uid' | 'createdAt'>) {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: "Authentication required. Please log in." };
    }
    try {
        await recordingsDb.addRecording(user.userId, recording);
        const recordings = await recordingsDb.getRecordings(user.userId);
        return { success: true, data: recordings };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to add recording.";
        return { success: false, error: message };
    }
}

export async function deleteRecordingAction(id: string) {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: "Authentication required. Please log in." };
    }
    try {
        await recordingsDb.deleteRecording(user.userId, id);
        const recordings = await recordingsDb.getRecordings(user.userId);
        return { success: true, data: recordings };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete recording.";
        return { success: false, error: message };
    }
}

// Dashboard Stats Action
export async function getDashboardStatsAction() {
    const user = await getAuthenticatedUser();
    if (!user) {
        return { success: false, error: "Authentication required. Please log in." };
    }
    
    try {
        const stats = await dashboardRepo.getDashboardMetrics(user.userId);
        
        return {
            success: true,
            data: {
                totalStudents: stats.totalStudents,
                totalGrades: stats.totalGrades,
                averageGrade: stats.averageGrade,
                hasGrades: stats.hasGrades,
                upcomingEvents: stats.upcomingEvents,
                totalRecordings: stats.totalRecordings,
                lessonsThisMonth: stats.lessonsThisMonth,
                attendanceRate: stats.attendanceRate,
                totalAttendanceSessions: stats.totalAttendanceSessions,
                hasAttendance: stats.hasAttendance,
                recentActivity: stats.recentActivity.map(act => ({
                    id: act.id,
                    type: act.type,
                    title: act.title,
                    date: act.date.toISOString(),
                    metadata: act.metadata,
                })),
            }
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to get dashboard stats.";
        return { success: false, error: message };
    }
}
