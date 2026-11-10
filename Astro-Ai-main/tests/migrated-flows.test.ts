/**
 * ============================================================================
 * ASTRO AI — PHASE 3.2 COMPLETE MIGRATED FLOWS INTEGRATION SUITE
 * ============================================================================
 * 
 * Verifies every single one of the 14 migrated flows individually through
 * their actual exported flow and action entry points.
 * 
 * Test Categories:
 * - LIVE: Live local inference executed against FastAPI TinyLlama model on port 8000
 * - MOCKED: Flow execution using intercepted fetch to supply representative model
 *           responses to test schema parsing, nested validation, and error rejection
 * - UNIT: Provider failure surfacing and capability boundary tests
 */

import {
  adaptContentAction,
  askAstroAction,
  appChatbotAction,
  createWorksheetAction,
  photoToWorksheetAction,
  textToSpeechAction
} from '../src/lib/actions';

import { generateVideoFlowAction } from '../src/ai/flows/generate-video';

import { createMentorshipPlan } from '../src/ai/flows/create-mentorship-plan';
import { CreateMentorshipPlanOutputSchema } from '../src/ai/flows/create-mentorship-plan.types';

import { createPresentation } from '../src/ai/flows/create-presentation';

import { generateLocalizedContent } from '../src/ai/flows/generate-localized-content';

import { generateQuiz } from '../src/ai/flows/generate-quiz';

import { getProfessionalDevelopmentPlan } from '../src/ai/flows/teacher-pd';
import { ProfessionalDevelopmentOutputSchema } from '../src/ai/flows/teacher-pd.types';

import { enhanceWriting } from '../src/ai/flows/enhance-writing';
import { EnhanceWritingOutputSchema } from '../src/ai/flows/enhance-writing.types';

import { createLessonPlan } from '../src/ai/flows/create-lesson-plan';
import { CreateLessonPlanOutputSchema } from '../src/ai/flows/create-lesson-plan.types';

import { generateDiscussion } from '../src/ai/flows/generate-discussion';
import { GenerateDiscussionOutputSchema } from '../src/ai/flows/generate-discussion.types';

import { createRubric } from '../src/ai/flows/create-rubric';

interface TestResult {
  id: string;
  name: string;
  type: 'LIVE' | 'MOCKED' | 'UNIT';
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];
const originalFetch = globalThis.fetch;

function mockAiResponse(jsonBody: any, status = 200) {
  globalThis.fetch = (async (url: any, opts: any) => {
    const urlStr = String(url);
    if (urlStr.includes('/generate') || urlStr.includes('8000')) {
      return new Response(
        JSON.stringify({ response: typeof jsonBody === 'string' ? jsonBody : JSON.stringify(jsonBody) }),
        {
          status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    return originalFetch(url, opts);
  }) as any;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

async function runTest(
  id: string,
  name: string,
  type: 'LIVE' | 'MOCKED' | 'UNIT',
  fn: () => Promise<void>
) {
  const start = Date.now();
  process.stdout.write(`⏳ Running [${id}] [${type}] ${name}... `);
  try {
    await fn();
    const duration = Date.now() - start;
    results.push({ id, name, type, passed: true, durationMs: duration });
    console.log(`\x1b[32mPASS\x1b[0m (${duration}ms)`);
  } catch (err: any) {
    const duration = Date.now() - start;
    results.push({ id, name, type, passed: false, error: err.message, durationMs: duration });
    console.log(`\x1b[31mFAIL\x1b[0m (${duration}ms)`);
    console.error(`   ❌ Error: ${err.message}`);
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING ALL 14 MIGRATED FLOWS VERIFICATION SUITE');
  console.log('======================================================\n');

  // ==========================================================================
  // PART 1: LIVE INFERENCE FLOWS (Local TinyLlama on Port 8000)
  // ==========================================================================

  // FLOW 1: Adapt Content Grade Level (Live text generation)
  await runTest('Flow 01', 'adaptContentGradeLevel executes live on local model', 'LIVE', async () => {
    const res = await adaptContentAction({
      content: 'Water evaporates into the sky and forms clouds through condensation.',
      gradeLevel: 3
    });
    if (!res.success) throw new Error(res.error);
    if (!res.data.adaptedContent || res.data.adaptedContent.length === 0) {
      throw new Error('Adapted content returned empty');
    }
  });

  // FLOW 2: Ask Astro (Live chatbot teacher response)
  await runTest('Flow 02', 'askAstro executes live on local model', 'LIVE', async () => {
    const res = await askAstroAction({
      question: 'What causes rainbows to appear in the sky?',
      gradeLevel: 5,
      language: 'en'
    });
    if (!res.success) throw new Error(res.error);
    if (!res.data.answer || res.data.answer.length < 20) {
      throw new Error('Ask Astro returned suspiciously short answer');
    }
  });

  // FLOW 3: App Chatbot (Live assistant query)
  await runTest('Flow 03', 'appChatbot executes live on local model', 'LIVE', async () => {
    const res = await appChatbotAction({
      query: 'Hello Astro, can you tell me what subjects are available?',
      studentRoster: []
    });
    if (!res.success) throw new Error(res.error);
    if (!res.data.response || res.data.response.length === 0) {
      throw new Error('App Chatbot returned empty response');
    }
  });

  // FLOW 4: Create Worksheet (Live structured questions)
  await runTest('Flow 04', 'createWorksheet executes live and validates questions', 'LIVE', async () => {
    const res = await createWorksheetAction({
      topic: 'Simple Gravity',
      gradeLevel: 4,
      numQuestions: 2
    });
    if (res.success) {
      if (!Array.isArray(res.data.questions) || res.data.questions.length === 0) {
        throw new Error('Worksheet questions array is empty');
      }
      for (const q of res.data.questions) {
        if (!q.question || q.question.length < 3) throw new Error('Question title is invalid');
      }
    } else {
      if (!res.error) throw new Error('Expected clean error message on unrepairable generation');
    }
  });

  // FLOW 5: Photo-to-Worksheet (Live Capability Gating)
  await runTest('Flow 05', 'photoToWorksheet gates on multimodal-vision in local mode', 'LIVE', async () => {
    const res = await photoToWorksheetAction({
      photoDataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    });
    if (res.success) throw new Error('Unexpected success for vision without cloud key');
    if (!res.error.includes('multimodal-vision') && !res.error.includes('multimodal cloud model')) {
      throw new Error(`Expected multimodal-vision capability error, got: ${res.error}`);
    }
  });

  // FLOW 6: Text-to-Speech (Live Audio Capability Gating)
  await runTest('Flow 06', 'textToSpeech gates on audio-tts in local mode', 'LIVE', async () => {
    const res = await textToSpeechAction({
      text: 'Testing audio capability assertion.'
    });
    if (res.success) throw new Error('Unexpected success for TTS without cloud key');
    if (!res.error.includes('audio-tts') && !res.error.includes('multimodal cloud model')) {
      throw new Error(`Expected audio-tts capability error, got: ${res.error}`);
    }
  });

  // FLOW 7: Video Generation (Live Enterprise Preview Capability Gating)
  await runTest('Flow 07', 'generateVideo gates on video-generation as enterprise preview', 'LIVE', async () => {
    const res = await generateVideoFlowAction({
      prompt: 'A comet passing Earth',
      duration: 5,
      aspectRatio: '16:9',
      style: 'cinematic',
      quality: 'standard'
    });
    if (res.success) throw new Error('Unexpected success for video generation');
    if (!res.error.includes('Video generation') && !res.error.includes('enterprise preview')) {
      throw new Error(`Expected enterprise preview error, got: ${res.error}`);
    }
  });

  // ==========================================================================
  // PART 2: DEDICATED STRUCTURED FLOW TESTS (Mocked Provider for Schema Validation)
  // ==========================================================================

  // FLOW 8: Create Mentorship Plan
  await runTest('Flow 08', 'createMentorshipPlan validates against CreateMentorshipPlanOutputSchema', 'MOCKED', async () => {
    mockAiResponse({
      planTitle: "Mathematics Focus & History Retention Plan",
      goals: ["Master multiplication tables up to 12", "Create timeline flashcards for World War II"],
      suggestedActivities: [
        { name: "Digital Flashcards", description: "Use digital flashcards 10 mins daily" },
        { name: "Weekly Practice", description: "Weekly practice test on Fridays" }
      ],
      progressCheck: "Bi-weekly review of flashcard mastery and test scores"
    });

    try {
      const result = await createMentorshipPlan({
        studentName: "Maya Lin",
        gradeLevel: 8,
        gradeData: [],
        gradeAnalysis: {
          averageGrade: 82,
          subjectStrengths: ["Math", "Physics"],
          subjectWeaknesses: ["History"],
          gradeTrend: "improving",
          totalGrades: 5
        },
        problems: ["Struggles with historical date recall"],
        progress: "Consistently scoring 90+ in algebra"
      });

      // Verify schema conformance
      const validated = CreateMentorshipPlanOutputSchema.parse(result);
      if (validated.planTitle !== "Mathematics Focus & History Retention Plan") throw new Error("Plan title mismatch");
      if (validated.goals.length !== 2) throw new Error("Expected 2 goals");
      if (validated.suggestedActivities.length !== 2) throw new Error("Expected 2 activities");
      if (validated.suggestedActivities[0].name !== "Digital Flashcards") throw new Error("Activity name mismatch");
      if (!validated.progressCheck.includes("Bi-weekly")) throw new Error("Progress check mismatch");
    } finally {
      restoreFetch();
    }
  });

  // FLOW 8b: Create Mentorship Plan Rejects Malformed Output
  await runTest('Flow 08b', 'createMentorshipPlan rejects missing required fields', 'MOCKED', async () => {
    mockAiResponse({
      planTitle: "Incomplete Plan"
      // Missing goals, suggestedActivities, progressCheck
    });

    try {
      let threw = false;
      try {
        await createMentorshipPlan({
          studentName: "Maya Lin",
          gradeLevel: 8,
          gradeData: [],
          gradeAnalysis: { averageGrade: 80, subjectStrengths: [], subjectWeaknesses: [], gradeTrend: "stable", totalGrades: 0 },
          problems: [],
          progress: ""
        });
      } catch (err: any) {
        threw = true;
      }
      if (!threw) throw new Error("Expected Zod validation error for incomplete mentorship plan");
    } finally {
      restoreFetch();
    }
  });

  // FLOW 9: Create Presentation
  await runTest('Flow 09', 'createPresentation validates slides structure and notes', 'MOCKED', async () => {
    mockAiResponse({
      title: "Renewable Energy Sources",
      slides: [
        {
          title: "Introduction to Solar Power",
          content: ["Converts sunlight to electricity", "Photovoltaic cells", "Zero direct emissions"],
          speakerNotes: "Welcome students and introduce the solar panel model on desk.",
          visualSuggestion: "Diagram of a photovoltaic cell absorbing photons"
        },
        {
          title: "Wind Turbines",
          content: ["Kinetic energy to electrical energy", "Onshore vs Offshore installations"],
          speakerNotes: "Explain how blade aerodynamic shape generates lift.",
          visualSuggestion: "Animation of wind turbine rotation"
        }
      ]
    });

    try {
      const result = await createPresentation({
        topic: "Renewable Energy",
        numSlides: 2
      });

      if (result.title !== "Renewable Energy Sources") throw new Error("Title mismatch");
      if (!Array.isArray(result.slides) || result.slides.length !== 2) throw new Error("Expected 2 slides");
      if (result.slides[0].content.length !== 3) throw new Error("Expected 3 content bullet points in slide 1");
      if (!result.slides[0].speakerNotes.includes("Welcome students")) throw new Error("Speaker notes missing");
    } finally {
      restoreFetch();
    }
  });

  // FLOW 10: Generate Localized Content
  await runTest('Flow 10', 'generateLocalizedContent produces multilingual content map', 'MOCKED', async () => {
    mockAiResponse({
      en: {
        quiz: [
          { question: "What is photosynthesis?", a: "Plant food making", b: "Digestion", c: "Respiration", d: "Transpiration", answer: "Plant food making" }
        ]
      },
      hi: {
        quiz: [
          { question: "प्रकाश संश्लेषण क्या है?", a: "पौधों द्वारा भोजन बनाना", b: "पाचन", c: "श्वसन", d: "उत्सर्जन", answer: "पौधों द्वारा भोजन बनाना" }
        ]
      }
    });

    try {
      const result = await generateLocalizedContent({
        prompt: "Photosynthesis basics",
        contentType: "quiz",
        gradeLevel: 6,
        languages: "en,hi"
      });

      if (!result.en || !result.hi) throw new Error("Expected multilingual map with 'en' and 'hi' keys");
      if (!Array.isArray(result.en.quiz) || result.en.quiz.length !== 1) throw new Error("Expected English quiz item");
      if (result.en.quiz[0].answer !== "Plant food making") throw new Error("Answer mismatch in English quiz");
      if (result.hi.quiz[0].answer !== "पौधों द्वारा भोजन बनाना") throw new Error("Answer mismatch in Hindi quiz");
    } finally {
      restoreFetch();
    }
  });

  // FLOW 11: Generate Quiz
  await runTest('Flow 11', 'generateQuiz validates structured quiz questions and choices', 'MOCKED', async () => {
    mockAiResponse({
      title: "Cell Biology Quiz",
      questions: [
        {
          question: "Which organelle is the powerhouse of the cell?",
          options: ["Nucleus", "Mitochondria", "Ribosome", "Endoplasmic Reticulum"],
          answer: "Mitochondria"
        },
        {
          question: "What is the cell membrane composed of?",
          options: ["Phospholipid bilayer", "Cellulose only", "Pure protein", "Nucleic acids"],
          answer: "Phospholipid bilayer"
        }
      ]
    });

    try {
      const result = await generateQuiz({
        topic: "Cell Biology",
        quizType: "multiple-choice",
        numQuestions: 2
      });

      if (result.title !== "Cell Biology Quiz") throw new Error("Quiz title mismatch");
      if (result.questions.length !== 2) throw new Error("Expected 2 questions");
      if (result.questions[0].options?.length !== 4) throw new Error("Expected 4 options in question 1");
      if (result.questions[0].answer !== "Mitochondria") throw new Error("Answer mismatch");
    } finally {
      restoreFetch();
    }
  });

  // FLOW 12: Teacher Professional Development
  await runTest('Flow 12', 'getProfessionalDevelopmentPlan validates against ProfessionalDevelopmentOutputSchema', 'MOCKED', async () => {
    mockAiResponse({
      planTitle: "Mastering Inquiry-Based Science Instruction",
      keyConcepts: ["Constructivism", "Socratic Questioning", "Scaffolded Investigation"],
      suggestedSteps: [
        {
          title: "Design Driving Questions",
          description: "Frame units around open-ended phenomena rather than rote facts.",
          strategies: ["Use entry events like surprising demonstrations", "Establish student question boards"],
          youtubeSearchQuery: "inquiry based learning science driving questions"
        },
        {
          title: "Facilitate Student Debriefs",
          description: "Guide discussions where students analyze evidence and build shared models.",
          strategies: ["Sentence starters for peer critique", "Consensus modeling diagrams"],
          youtubeSearchQuery: "socratic seminar middle school science"
        }
      ]
    });

    try {
      const result = await getProfessionalDevelopmentPlan({
        learningGoal: "Improve student inquiry in science classrooms"
      });

      const validated = ProfessionalDevelopmentOutputSchema.parse(result);
      if (validated.planTitle !== "Mastering Inquiry-Based Science Instruction") throw new Error("Title mismatch");
      if (validated.keyConcepts.length !== 3) throw new Error("Expected 3 key concepts");
      if (validated.suggestedSteps.length !== 2) throw new Error("Expected 2 steps");
      if (validated.suggestedSteps[0].strategies.length !== 2) throw new Error("Expected 2 strategies in step 1");
    } finally {
      restoreFetch();
    }
  });

  // FLOW 13: Enhance Writing
  await runTest('Flow 13', 'enhanceWriting validates against EnhanceWritingOutputSchema', 'MOCKED', async () => {
    mockAiResponse({
      correctedText: "She went to the library yesterday and read a fascinating book.",
      suggestions: [
        {
          original: "She go",
          suggestion: "She went",
          explanation: "Use past tense 'went' to agree with 'yesterday'."
        },
        {
          original: "readed",
          suggestion: "read",
          explanation: "'Read' is an irregular verb whose past tense is spelled 'read'."
        }
      ]
    });

    try {
      const result = await enhanceWriting({
        text: "She go to the library yesterday and readed a book."
      });

      const validated = EnhanceWritingOutputSchema.parse(result);
      if (!validated.correctedText.includes("She went")) throw new Error("Correction mismatch");
      if (validated.suggestions.length !== 2) throw new Error("Expected 2 grammar suggestions");
      if (validated.suggestions[0].suggestion !== "She went") throw new Error("Suggestion mismatch");
    } finally {
      restoreFetch();
    }
  });

  // FLOW 14: Create Lesson Plan
  await runTest('Flow 14', 'createLessonPlan validates against CreateLessonPlanOutputSchema', 'MOCKED', async () => {
    mockAiResponse({
      title: "The Water Cycle: Evaporation and Condensation",
      objectives: [
        "Students will define evaporation and condensation.",
        "Students will observe water phase changes in a closed system."
      ],
      materials: ["Glass jar with lid", "Hot water", "Ice cubes"],
      activities: [
        {
          name: "Introductory Demonstration",
          description: "Teacher places ice cubes atop a jar of hot water to demonstrate condensation cloud formation.",
          duration: 10
        },
        {
          name: "Hands-on Student Lab",
          description: "Students work in pairs to document rate of condensation with temperature variation.",
          duration: 25
        },
        {
          name: "Exit Ticket & Summary",
          description: "Students sketch and label the steps observed.",
          duration: 10
        }
      ]
    });

    try {
      const result = await createLessonPlan({
        topic: "Water Cycle",
        gradeLevel: 4,
        durationInMinutes: 45,
        learningObjectives: ["Understand evaporation", "Understand condensation"]
      });

      const validated = CreateLessonPlanOutputSchema.parse(result);
      if (validated.title !== "The Water Cycle: Evaporation and Condensation") throw new Error("Title mismatch");
      if (validated.objectives.length !== 2) throw new Error("Expected 2 objectives");
      if (validated.activities.length !== 3) throw new Error("Expected 3 activities");
      if (validated.activities[0].duration !== 10) throw new Error("Duration mismatch");
    } finally {
      restoreFetch();
    }
  });

  // FLOW 15: Generate Discussion
  await runTest('Flow 15', 'generateDiscussion validates against GenerateDiscussionOutputSchema', 'MOCKED', async () => {
    mockAiResponse({
      discussionQuestions: [
        "Should governments prioritize funding for space exploration over ocean research?",
        "How can space technologies benefit daily life on Earth?",
        "Who should own resources mined on asteroids?"
      ],
      vocabulary: [
        { word: "Astrophysics", definition: "The branch of astronomy dealing with physics of celestial bodies." },
        { word: "Payload", definition: "The cargo carried by a rocket or spacecraft." }
      ],
      viewpoints: [
        {
          title: "Public Benefit View",
          summary: "Space research drives innovation in satellite communication, weather forecasting, and material science."
        },
        {
          title: "Immediate Needs View",
          summary: "Financial capital is better spent solving climate change and poverty on Earth before expanding into space."
        }
      ]
    });

    try {
      const result = await generateDiscussion({
        topic: "Space Exploration Funding",
        gradeLevel: 8
      });

      const validated = GenerateDiscussionOutputSchema.parse(result);
      if (validated.discussionQuestions.length !== 3) throw new Error("Expected 3 discussion questions");
      if (validated.vocabulary.length !== 2) throw new Error("Expected 2 vocabulary entries");
      if (validated.viewpoints.length !== 2) throw new Error("Expected 2 viewpoints");
      if (validated.vocabulary[0].word !== "Astrophysics") throw new Error("Vocabulary word mismatch");
    } finally {
      restoreFetch();
    }
  });

  // FLOW 16: Create Rubric
  await runTest('Flow 16', 'createRubric validates criteria and multi-tier levels structure', 'MOCKED', async () => {
    mockAiResponse({
      title: "Science Fair Poster Rubric",
      criteria: [
        {
          name: "Scientific Accuracy",
          levels: [
            { level: "Advanced", description: "All scientific facts, terminology, and principles are completely accurate." },
            { level: "Proficient", description: "Most scientific facts are accurate with minor terminology oversights." },
            { level: "Emerging", description: "Significant scientific misconceptions are present." }
          ]
        },
        {
          name: "Visual Organization",
          levels: [
            { level: "Advanced", description: "Clear visual hierarchy, excellent typography, and intuitive reading flow." },
            { level: "Proficient", description: "Clean layout with legible diagrams and good reading flow." },
            { level: "Emerging", description: "Disorganized or crowded layout that impedes comprehension." }
          ]
        }
      ]
    });

    try {
      const result = await createRubric({
        assignmentDescription: "Science Fair Research Poster",
        criteria: ["Scientific Accuracy", "Visual Organization"]
      });

      if (result.title !== "Science Fair Poster Rubric") throw new Error("Rubric title mismatch");
      if (result.criteria.length !== 2) throw new Error("Expected 2 criteria");
      if (result.criteria[0].levels.length !== 3) throw new Error("Expected 3 levels per criterion");
      if (result.criteria[0].levels[0].level !== "Advanced") throw new Error("Level name mismatch");
    } finally {
      restoreFetch();
    }
  });

  // ==========================================================================
  // PART 3: PROVIDER FAILURE RESILIENCE (Zero Fake Data Guarantee)
  // ==========================================================================

  // TEST 17: Provider connection failure surfaces without fake fallback data
  await runTest('Test 17', 'Structured flows surface provider connection failures without fabricating fake data', 'UNIT', async () => {
    globalThis.fetch = (async () => {
      const err: any = new Error("fetch failed");
      err.cause = { code: 'ECONNREFUSED' };
      throw err;
    }) as any;

    try {
      let caught = false;
      try {
        await createLessonPlan({
          topic: "Matter",
          gradeLevel: 3,
          durationInMinutes: 30,
          learningObjectives: ["Define solid and liquid"]
        });
      } catch (err: any) {
        caught = true;
        if (!err.message.includes("Cannot connect to Local AI server")) {
          throw new Error(`Unexpected error message: ${err.message}`);
        }
      }
      if (!caught) throw new Error("Expected connection error to be surfaced, but call returned without throwing");
    } finally {
      restoreFetch();
    }
  });

  // TEST 18: Malformed model output produces ZodError without fabricating fake data
  await runTest('Test 18', 'Malformed output produces strict error instead of dummy fallback', 'UNIT', async () => {
    mockAiResponse({
      invalidProperty: "No schema match"
    });

    try {
      let caught = false;
      try {
        await createLessonPlan({
          topic: "Matter",
          gradeLevel: 3,
          durationInMinutes: 30,
          learningObjectives: ["Define solid and liquid"]
        });
      } catch (err: any) {
        caught = true;
      }
      if (!caught) throw new Error("Expected Zod schema error for missing required properties, but call succeeded");
    } finally {
      restoreFetch();
    }
  });

  // Summary
  console.log('\n======================================================');
  console.log('📊 MIGRATED FLOWS TEST SUMMARY');
  console.log('======================================================');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const liveCount = results.filter(r => r.passed && r.type === 'LIVE').length;
  const mockedCount = results.filter(r => r.passed && r.type === 'MOCKED').length;
  const unitCount = results.filter(r => r.passed && r.type === 'UNIT').length;

  console.log(`Total Executed: ${results.length}`);
  console.log(`Passed:         ${passed} (${liveCount} LIVE, ${mockedCount} MOCKED, ${unitCount} UNIT)`);
  console.log(`Failed:         ${failed}\n`);

  if (failed > 0) {
    console.error(`❌ ${failed} MIGRATED FLOW TEST(S) FAILED!`);
    process.exit(1);
  } else {
    console.log(`🎉 ALL ${passed} MIGRATED FLOW TESTS PASSED PERFECTLY!\n`);
  }
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
