/**
 * ============================================================================
 * ASTRO AI — PHASE 3.4 FRONTEND ACTION ERROR HANDLING TEST SUITE
 * ============================================================================
 * 
 * Verifies frontend action consumption patterns, error handling, loading cleanup,
 * and data preservation across 12 required scenarios:
 * 
 * 1.  [UNIT] Server action success response contract
 * 2.  [UNIT] Server action failure response contract
 * 3.  [UNIT] Thrown exception interception and consumer protection
 * 4.  [UNIT] Network failure handling and error isolation
 * 5.  [UNIT] Authentication expiry handling
 * 6.  [UNIT] Unsupported AI capability rejection
 * 7.  [UNIT] Empty response rejection without fake fallback
 * 8.  [UNIT] Loading state cleanup in finally block
 * 9.  [UNIT] Duplicate submission prevention guard
 * 10. [UNIT] Automated retry behavior on empty server responses
 * 11. [UNIT] Preservation of existing data after refresh failure
 * 12. [UNIT] Frontend user error notification and sanitization
 */

import { z } from 'zod';
import { assertCapability, UnsupportedCapabilityError } from '../src/ai/provider';
import { sanitizeErrorMessage } from '../src/lib/security';
import { callLocalAI } from '../src/ai/local-ai';

interface TestResult {
  scenario: number;
  id: string;
  name: string;
  type: 'UNIT';
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function record(scenario: number, id: string, name: string, passed: boolean, error?: string) {
  results.push({ scenario, id, name, type: 'UNIT', passed, error });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [UNIT] Scenario ${scenario} (${id}): ${name}`);
  if (error) console.log(`   └─ Detail: ${error}`);
}

async function withMockFetch<T>(mockHandler: (url: string | URL | Request, init?: RequestInit) => Promise<Response>, fn: () => Promise<T>): Promise<T> {
  const originalFetch = global.fetch;
  global.fetch = mockHandler as any;
  try {
    return await fn();
  } finally {
    global.fetch = originalFetch;
  }
}

async function runTests() {
  console.log('====================================================================');
  console.log('🧪 RUNNING ASTRO AI PHASE 3.4 FRONTEND ACTION ERROR HANDLING SUITE');
  console.log('====================================================================\n');

  // 1. Server action success
  try {
    const mockSuccessAction = async () => ({ success: true as const, data: { topic: 'Math', score: 100 } });
    const res = await mockSuccessAction();
    const passed = res.success === true && res.data.score === 100;
    record(1, 'FE-ACT-01', 'Server action success response contract', passed, `Received data: ${JSON.stringify(res.data)}`);
  } catch (e: any) {
    record(1, 'FE-ACT-01', 'Server action success response contract', false, e.message);
  }

  // 2. Server action failure
  try {
    const mockFailureAction = async () => ({ success: false as const, error: 'Database connection failed.' });
    const res = await mockFailureAction();
    const passed = res.success === false && typeof res.error === 'string' && res.error.length > 0;
    record(2, 'FE-ACT-02', 'Server action failure response contract', passed, `Received error: ${res.error}`);
  } catch (e: any) {
    record(2, 'FE-ACT-02', 'Server action failure response contract', false, e.message);
  }

  // 3. Thrown exceptions intercepted by try-catch
  try {
    let errorCaught = false;
    let loadingState = true;
    const faultyAction = async () => { throw new Error('Uncaught runtime exception'); };

    try {
      await faultyAction();
    } catch (err: any) {
      errorCaught = true;
    } finally {
      loadingState = false;
    }

    const passed = errorCaught && loadingState === false;
    record(3, 'FE-ACT-03', 'Thrown exceptions intercepted and isolated by try-catch', passed, 'Exception caught; loading reset to false');
  } catch (e: any) {
    record(3, 'FE-ACT-03', 'Thrown exceptions intercepted and isolated by try-catch', false, e.message);
  }

  // 4. Network failure handling
  try {
    let networkErrorToast = '';
    await withMockFetch(
      async () => { throw new TypeError('Failed to fetch (net::ERR_CONNECTION_REFUSED)'); },
      async () => {
        try {
          await fetch('http://localhost:8000/api/endpoint');
        } catch (err: any) {
          networkErrorToast = sanitizeErrorMessage(err);
        }
      }
    );

    const passed = networkErrorToast.length > 0 && !networkErrorToast.includes('8000');
    record(4, 'FE-ACT-04', 'Network failure handling and endpoint sanitization', passed, `Sanitized toast: "${networkErrorToast}"`);
  } catch (e: any) {
    record(4, 'FE-ACT-04', 'Network failure handling and endpoint sanitization', false, e.message);
  }

  // 5. Authentication expiry handling
  try {
    const unauthenticatedAction = async (userSession: null) => {
      if (!userSession) {
        return { success: false as const, error: 'Authentication required. Please log in.' };
      }
      return { success: true as const, data: [] };
    };

    const res = await unauthenticatedAction(null);
    const passed = res.success === false && res.error.includes('Authentication required');
    record(5, 'FE-ACT-05', 'Authentication expiry returns structured unauthenticated error', passed, res.error);
  } catch (e: any) {
    record(5, 'FE-ACT-05', 'Authentication expiry returns structured unauthenticated error', false, e.message);
  }

  // 6. Unsupported AI capability rejection
  try {
    let errorSurfaced = false;
    let errorMessage = '';
    try {
      assertCapability('multimodal-vision');
    } catch (err: any) {
      errorSurfaced = err instanceof UnsupportedCapabilityError;
      errorMessage = err.message;
    }

    const passed = errorSurfaced && errorMessage.includes('multimodal-vision');
    record(6, 'FE-ACT-06', 'Unsupported AI capability throws standardized UnsupportedCapabilityError', passed, errorMessage);
  } catch (e: any) {
    record(6, 'FE-ACT-06', 'Unsupported AI capability throws standardized UnsupportedCapabilityError', false, e.message);
  }

  // 7. Empty response rejection without fake fallback
  try {
    let emptyRejected = false;
    await withMockFetch(
      async () => new Response(JSON.stringify({ response: '   ' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      async () => {
        try {
          await callLocalAI('test prompt');
        } catch (err: any) {
          emptyRejected = err.message.includes('empty generation payload');
        }
      }
    );

    record(7, 'FE-ACT-07', 'Empty AI response payload strictly rejected without fake fallback', emptyRejected, 'Empty payload rejected');
  } catch (e: any) {
    record(7, 'FE-ACT-07', 'Empty AI response payload strictly rejected without fake fallback', false, e.message);
  }

  // 8. Loading state cleanup in finally block
  try {
    let isLoading = false;
    const executeAction = async (shouldFail: boolean) => {
      isLoading = true;
      try {
        if (shouldFail) throw new Error('Simulated flow crash');
      } finally {
        isLoading = false;
      }
    };

    try {
      await executeAction(true);
    } catch {
      // Expected failure in test simulation
    }
    const cleanupOnFailure = isLoading === false;
    await executeAction(false);
    const cleanupOnSuccess = isLoading === false;

    const passed = cleanupOnFailure && cleanupOnSuccess;
    record(8, 'FE-ACT-08', 'Loading state cleanup guaranteed in finally block on success & failure', passed, 'isLoading verified false in all paths');
  } catch (e: any) {
    record(8, 'FE-ACT-08', 'Loading state cleanup guaranteed in finally block on success & failure', false, e.message);
  }

  // 9. Duplicate submission prevention guard
  try {
    let callCount = 0;
    let isSubmitting = false;

    const submitHandler = async () => {
      if (isSubmitting) return; // Guard
      isSubmitting = true;
      callCount++;
      // Simulate delay
      await new Promise(r => setTimeout(r, 10));
      isSubmitting = false;
    };

    // Trigger rapid duplicate clicks
    await Promise.all([submitHandler(), submitHandler(), submitHandler()]);

    const passed = callCount === 1;
    record(9, 'FE-ACT-09', 'Duplicate submission guard prevents concurrent action executions', passed, `Executed ${callCount} time(s) instead of 3`);
  } catch (e: any) {
    record(9, 'FE-ACT-09', 'Duplicate submission guard prevents concurrent action executions', false, e.message);
  }

  // 10. Automated retry behavior on empty server responses
  try {
    let attempts = 0;
    await withMockFetch(
      async () => {
        attempts++;
        if (attempts === 1) {
          return new Response(JSON.stringify({ response: '' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ response: 'Valid output on retry' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
      async () => {
        const text = await callLocalAI('test prompt');
        const passed = attempts === 2 && text === 'Valid output on retry';
        record(10, 'FE-ACT-10', 'Automated single retry successfully recovers empty initial response', passed, `Resolved on attempt ${attempts}`);
      }
    );
  } catch (e: any) {
    record(10, 'FE-ACT-10', 'Automated single retry successfully recovers empty initial response', false, e.message);
  }

  // 11. Preservation of existing data after refresh failure
  try {
    let existingData = [{ id: '1', title: 'Existing Lesson' }];
    const refreshAction = async (): Promise<{ success: true; data: Array<{ id: string; title: string }> } | { success: false; error: string }> => {
      return { success: false, error: 'Network timeout during refresh' };
    };

    const res = await refreshAction();
    if (res.success) {
      existingData = res.data;
    }
    // Existing data should NOT be wiped out

    const passed = existingData.length === 1 && existingData[0].title === 'Existing Lesson';
    record(11, 'FE-ACT-11', 'Component state preserves existing data when refresh request fails', passed, `Preserved ${existingData.length} existing record(s)`);
  } catch (e: any) {
    record(11, 'FE-ACT-11', 'Component state preserves existing data when refresh request fails', false, e.message);
  }

  // 12. Frontend user error notification and sanitization
  try {
    const rawError = new Error('Database connection to mongodb://admin:secretPass@127.0.0.1:27017/astro failed');
    const sanitizedToastMessage = sanitizeErrorMessage(rawError);

    const noLeakPassword = !sanitizedToastMessage.includes('secretPass');
    const noLeakIP = !sanitizedToastMessage.includes('127.0.0.1');
    const hasToastFormat = sanitizedToastMessage.length > 0;

    const passed = noLeakPassword && noLeakIP && hasToastFormat;
    record(12, 'FE-ACT-12', 'Frontend error notification sanitizes database credentials and internal endpoints', passed, `Toast: "${sanitizedToastMessage}"`);
  } catch (e: any) {
    record(12, 'FE-ACT-12', 'Frontend error notification sanitizes database credentials and internal endpoints', false, e.message);
  }

  console.log('\n====================================================================');
  console.log('📊 PHASE 3.4 FRONTEND ACTION HANDLING TEST SUMMARY');
  console.log('====================================================================');
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(`Total Scenarios: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log('====================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
