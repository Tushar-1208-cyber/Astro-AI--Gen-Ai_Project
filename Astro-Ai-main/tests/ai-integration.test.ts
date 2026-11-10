/**
 * ============================================================================
 * ASTRO AI — PHASE 3 AI INTEGRATION & STABILITY VERIFICATION TEST SUITE
 * ============================================================================
 * 
 * Verifies:
 * 1. Local AI Server (FastAPI TinyLlama LoRA) connectivity and health.
 * 2. Ask Astro Server Action execution against live local model.
 * 3. App Chatbot routing without disguised error strings.
 * 4. Worksheet Creator: elimination of silent dummy question/option injection.
 * 5. Rubric Creator: elimination of hardcoded fake criteria levels.
 * 6. Student Recognition: elimination of fraudulent 100% attendance fallback.
 * 7. Genkit Type Safety and Flow execution (TTS voices, QR codes, search URLs).
 * 8. Video Generation: clean capability and access reporting.
 */

import { askAstroAction, appChatbotAction, createWorksheetAction, createRubricAction, recognizeStudentsAction, getTtsVoicesAction, generateQrCodeAction, searchYoutubeVideosAction, generateVideoAction } from '../src/lib/actions';
import { callLocalAI } from '../src/ai/local-ai';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function runTest(id: string, name: string, fn: () => Promise<void>) {
  const start = Date.now();
  process.stdout.write(`⏳ Running [${id}] ${name}... `);
  try {
    await fn();
    const duration = Date.now() - start;
    results.push({ id, name, passed: true, durationMs: duration });
    console.log(`\x1b[32mPASS\x1b[0m (${duration}ms)`);
  } catch (err: any) {
    const duration = Date.now() - start;
    results.push({ id, name, passed: false, error: err.message, durationMs: duration });
    console.log(`\x1b[31mFAIL\x1b[0m (${duration}ms)`);
    console.error(`   ❌ Error: ${err.message}`);
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING ASTRO AI PHASE 3 AI INTEGRATION TEST SUITE');
  console.log('======================================================\n');

  // TEST 1: Local AI Server Health
  await runTest('Test 01', 'Local AI Server health check on port 8000', async () => {
    const res = await fetch('http://localhost:8000/', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`Health check failed with status ${res.status}`);
    const data = await res.json();
    if (data.status !== 'ready' || !data.model) {
      throw new Error(`Unexpected health payload: ${JSON.stringify(data)}`);
    }
  });

  // TEST 2: Local AI Generation Direct Execution
  await runTest('Test 02', 'Local AI Direct Generation (TinyLlama LoRA)', async () => {
    const response = await callLocalAI('Instruction: What is 2 + 2?\nResponse:', 50);
    if (!response || response.trim().length === 0) {
      throw new Error('Local AI returned empty response');
    }
  });

  // TEST 3: Ask Astro Server Action Live Execution
  await runTest('Test 03', 'Ask Astro Action live response from GPU model', async () => {
    const result = await askAstroAction({
      question: 'What is photosynthesis in simple terms?',
      gradeLevel: 6,
      language: 'en'
    });
    if (!result.success) {
      throw new Error(`Ask Astro failed: ${result.error}`);
    }
    if (!result.data.answer || result.data.answer.length < 20) {
      throw new Error(`Ask Astro returned suspiciously short answer: "${result.data.answer}"`);
    }
    // Verify no disguised error string
    if (result.data.answer.includes("Connection to Astro AI Server failed") || result.data.answer.includes("py -3.12 ai_server.py")) {
      throw new Error(`Disguised error string detected in response: ${result.data.answer}`);
    }
  });

  // TEST 4: App Chatbot Action Execution
  await runTest('Test 04', 'App Chatbot Action routing to Local AI', async () => {
    const result = await appChatbotAction({
      query: 'Hello Astro, can you help me prepare a lesson?',
      studentRoster: []
    });
    if (!result.success) {
      throw new Error(`App chatbot failed: ${result.error}`);
    }
    if (!result.data.response || result.data.response.length < 5) {
      throw new Error('Chatbot response is empty');
    }
    // Verify no disguised Ollama offline error string
    if (result.data.response.includes("I can't reach Ollama") || result.data.response.includes("ollama run llama3")) {
      throw new Error(`Disguised Ollama error returned as successful chat message: ${result.data.response}`);
    }
  });

  // TEST 5: Elimination of Mock Attendance Fallback
  await runTest('Test 05', 'Student Recognition rejects mock 100% presence on failure', async () => {
    // Attempt recognition with an invalid image (no teacher session or bad image)
    const result = await recognizeStudentsAction({
      photoDataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    });

    // It MUST fail cleanly with an error or require auth, NOT return students as present!
    if (result.success) {
      throw new Error('Unexpected success without authenticated session');
    } else {
      if (!result.error || result.error.length === 0) {
        throw new Error('Action returned success=false without error message');
      }
    }
  });

  // TEST 6: Worksheet Creator Rejects Dummy Placeholder Injection
  await runTest('Test 06', 'Worksheet Creator does not inject dummy questions or dummy options', async () => {
    const result = await createWorksheetAction({
      topic: 'Solar System Planets',
      gradeLevel: 5,
      numQuestions: 3
    });

    if (result.success) {
      for (const q of result.data.questions) {
        if (q.question.includes('Explain the importance of') && q.question.includes('in our daily lives.')) {
          throw new Error(`Sanitizer dummy placeholder question detected: ${q.question}`);
        }
        if (q.options && q.options.length > 0) {
          const isDummyOptions = q.options.includes('Option A') && q.options.includes('Option B');
          if (isDummyOptions) {
            throw new Error(`Sanitizer dummy options detected: ${JSON.stringify(q.options)}`);
          }
        }
      }
    } else {
      // If AI server could not generate valid schema, it must throw an explicit error rather than injecting fake questions
      if (!result.error) throw new Error('Expected clean error message on generation failure');
    }
  });

  // TEST 7: Rubric Creator Rejects Dummy Levels Injection
  await runTest('Test 07', 'Rubric Creator does not inject hardcoded mock criteria levels', async () => {
    const result = await createRubricAction({
      assignmentDescription: 'Essay on Renewable Energy Sources',
      criteria: ['Research Depth', 'Clarity']
    });

    if (result.success) {
      for (const c of result.data.criteria) {
        for (const l of c.levels) {
          if (l.description.includes('demonstrates complete mastery of') && l.description.includes('with highly professional execution and zero errors')) {
            throw new Error(`Sanitizer dummy criteria level detected: ${l.description}`);
          }
        }
      }
    } else {
      if (!result.error) throw new Error('Expected clean error message on generation failure');
    }
  });

  // TEST 8: Get TTS Voices returns valid typed catalogue
  await runTest('Test 08', 'Get TTS Voices returns supported voices without Genkit crash', async () => {
    const result = await getTtsVoicesAction('en');
    if (!result.success) throw new Error(`getTtsVoicesAction failed: ${result.error}`);
    if (!Array.isArray(result.data) || result.data.length === 0) {
      throw new Error('Expected non-empty list of TTS voices');
    }
    const voice = result.data[0];
    if (!voice.name || !voice.service || !voice.languageCodes || !voice.gender) {
      throw new Error(`Voice object missing required schema fields: ${JSON.stringify(voice)}`);
    }
  });

  // TEST 9: QR Code Generation Flow
  await runTest('Test 09', 'Answer Key QR Code Generator creates valid Data URI', async () => {
    const result = await generateQrCodeAction({ answerKey: '1. A, 2. B, 3. C, 4. D' });
    if (!result.success) throw new Error(`generateQrCodeAction failed: ${result.error}`);
    if (!result.data.qrCodeDataUri.startsWith('data:image/png;base64,')) {
      throw new Error(`Malformed QR code data URI: ${result.data.qrCodeDataUri.substring(0, 30)}`);
    }
  });

  // TEST 10: YouTube Search Generator Flow
  await runTest('Test 10', 'YouTube Search flow constructs valid educational query URL', async () => {
    const result = await searchYoutubeVideosAction({
      topic: 'Photosynthesis',
      grade: '6',
      subject: 'Science',
      language: 'English'
    });
    if (!result.success) throw new Error(`searchYoutubeVideosAction failed: ${result.error}`);
    if (!result.data.searchUrl.startsWith('https://www.youtube.com/results?search_query=')) {
      throw new Error(`Malformed search URL: ${result.data.searchUrl}`);
    }
  });

  // TEST 11: Video Generation Capability & Access Handling
  await runTest('Test 11', 'Video Generation reports capability status clearly without crashing', async () => {
    const result = await generateVideoAction({
      prompt: 'A solar eclipse visualization',
      duration: 5,
      aspectRatio: '16:9',
      style: 'cinematic',
      quality: 'standard'
    });
    // Expected to report non-availability gracefully without unhandled crash
    if (result.success) {
      if (!result.data?.videoUrl) throw new Error('Video reported success without videoUrl');
    } else {
      if (!result.error) throw new Error('Expected error description for video capability check');
    }
  });

  // Summary
  console.log('\n======================================================');
  console.log('📊 TEST SUMMARY RESULTS');
  console.log('======================================================');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`Total Executed: ${results.length}`);
  console.log(`Passed:         ${passed}`);
  console.log(`Failed:         ${failed}\n`);

  if (failed > 0) {
    console.error(`❌ ${failed} AI INTEGRATION TEST(S) FAILED!`);
    process.exit(1);
  } else {
    console.log(`🎉 ALL ${passed} AI INTEGRATION TESTS PASSED PERFECTLY!\n`);
  }
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
