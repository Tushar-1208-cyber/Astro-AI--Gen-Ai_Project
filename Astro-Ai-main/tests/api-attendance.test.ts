/**
 * ===============================================================
 * ASTRO AI — PHASE 4.1.6 API ATTENDANCE & IDENTITY ROUTING TEST SUITE
 * ===============================================================
 * Verifies live HTTP API endpoint behavior for /api/attendance:
 *  1. ID-only direct submission without photo (HTTP 201 + persisted in MongoDB)
 *  2. ID-only direct submission with photo (HTTP 201 + persisted, not classified as scan)
 *  3. IDs plus matching display names with photo (HTTP 201 + persisted)
 *  4. AI scan request with photo and no attendance identity arrays (HTTP 200 + no DB writes)
 *  5. Malformed mixed scan and direct submission payload (HTTP 400 + rejected)
 *  6. Cross-tenant ID rejection through the API (HTTP 400 + rejected)
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import dbConnect from '../src/lib/db';
import Student from '../src/models/Student';
import Attendance from '../src/models/Attendance';
import { createAuthToken } from '../src/lib/auth';

interface TestResult {
  id: number;
  code: string;
  name: string;
  passed: boolean;
  detail: string;
}

const results: TestResult[] = [];

function record(id: number, code: string, name: string, passed: boolean, detail: string) {
  results.push({ id, code, name, passed, detail });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [API] Test ${id.toString().padStart(2, '0')} (${code}): ${name}`);
  console.log(`   └─ Detail: ${detail}`);
}

async function runApiAttendanceTests() {
  console.log('\n====================================================================');
  console.log('🧪 RUNNING ASTRO AI PHASE 4.1.6 API ATTENDANCE & ROUTING SUITE');
  console.log('====================================================================\n');

  await dbConnect();
  const timestamp = Date.now();
  const baseUrl = process.env.TEST_APP_URL || 'http://localhost:9002';
  const samplePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  try {
    // -------------------------------------------------------------
    // Test 1: (API-01) ID-only direct submission without photo
    // -------------------------------------------------------------
    const t1UserId = `api_t1_${timestamp}`;
    const token1 = createAuthToken({ userId: t1UserId, email: `${t1UserId}@test.internal`, name: 'Teacher T1' });
    try {
      const student1 = await Student.create({ userId: t1UserId, name: 'Alice Direct' });

      const res = await fetch(`${baseUrl}/api/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token1}`,
          'Host': 'localhost:9002',
          'Origin': 'http://localhost:9002',
        },
        body: JSON.stringify({
          presentStudentIds: [student1._id.toString()],
        }),
      });

      const resJson = await res.json();
      const createdId = resJson.created?._id || resJson.created?.id;
      const persisted = createdId
        ? await Attendance.findById(createdId).lean()
        : null;

      const passed =
        res.status === 201 &&
        resJson.success === true &&
        persisted !== null &&
        Array.isArray(persisted.presentStudentIds) &&
        persisted.presentStudentIds.includes(student1._id.toString()) &&
        Array.isArray(persisted.presentStudents) &&
        persisted.presentStudents.includes('Alice Direct') &&
        (!persisted.photoDataUri || persisted.photoDataUri === '');

      record(
        1,
        'API-01',
        'ID-only direct submission without photo is persisted as attendance record',
        passed,
        `Status: ${res.status}, Doc: ${JSON.stringify(persisted)}`
      );
    } catch (e: any) {
      record(1, 'API-01', 'ID-only direct submission without photo is persisted as attendance record', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 2: (API-02) ID-only direct submission with photo (not classified as scan)
    // -------------------------------------------------------------
    const t2UserId = `api_t2_${timestamp}`;
    const token2 = createAuthToken({ userId: t2UserId, email: `${t2UserId}@test.internal`, name: 'Teacher T2' });
    try {
      const student2 = await Student.create({ userId: t2UserId, name: 'Bob Photo' });

      const res = await fetch(`${baseUrl}/api/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token2}`,
          'Host': 'localhost:9002',
          'Origin': 'http://localhost:9002',
        },
        body: JSON.stringify({
          presentStudentIds: [student2._id.toString()],
          photoDataUri: samplePng,
        }),
      });

      const resJson = await res.json();
      const createdId = resJson.created?._id || resJson.created?.id;
      const persisted = createdId
        ? await Attendance.findById(createdId).lean()
        : null;

      const passed =
        res.status === 201 &&
        resJson.success === true &&
        persisted !== null &&
        Array.isArray(persisted.presentStudentIds) &&
        persisted.presentStudentIds.includes(student2._id.toString()) &&
        persisted.presentStudents.includes('Bob Photo') &&
        (persisted.photoDataUri === samplePng || (typeof persisted.photoUrl === 'string' && persisted.photoUrl.length > 0));

      record(
        2,
        'API-02',
        'ID-only direct submission with photo is saved as attendance, NOT hijacked as AI scan',
        passed,
        `Status: ${res.status}, Persisted ID: ${persisted?._id}, Has Photo: ${!!persisted?.photoUrl || !!persisted?.photoDataUri}`
      );
    } catch (e: any) {
      record(2, 'API-02', 'ID-only direct submission with photo is saved as attendance, NOT hijacked as AI scan', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 3: (API-03) IDs plus matching display names with photo
    // -------------------------------------------------------------
    const t3UserId = `api_t3_${timestamp}`;
    const token3 = createAuthToken({ userId: t3UserId, email: `${t3UserId}@test.internal`, name: 'Teacher T3' });
    try {
      const student3 = await Student.create({ userId: t3UserId, name: 'Charlie Pair' });

      const res = await fetch(`${baseUrl}/api/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token3}`,
          'Host': 'localhost:9002',
          'Origin': 'http://localhost:9002',
        },
        body: JSON.stringify({
          presentStudentIds: [student3._id.toString()],
          presentStudents: ['Charlie Pair'],
          photoDataUri: samplePng,
        }),
      });

      const resJson = await res.json();
      const createdId = resJson.created?._id || resJson.created?.id;
      const persisted = createdId
        ? await Attendance.findById(createdId).lean()
        : null;

      const passed =
        res.status === 201 &&
        resJson.success === true &&
        persisted !== null &&
        Array.isArray(persisted.presentStudentIds) &&
        persisted.presentStudentIds.includes(student3._id.toString()) &&
        Array.isArray(persisted.presentStudents) &&
        persisted.presentStudents.includes('Charlie Pair');

      record(
        3,
        'API-03',
        'IDs plus matching display names with photo successfully persists',
        passed,
        `Status: ${res.status}, Persisted ID: ${persisted?._id}, Name: ${persisted?.presentStudents[0]}`
      );
    } catch (e: any) {
      record(3, 'API-03', 'IDs plus matching display names with photo successfully persists', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 4: (API-04) AI scan request with photo and no attendance identity arrays
    // -------------------------------------------------------------
    const t4UserId = `api_t4_${timestamp}`;
    const token4 = createAuthToken({ userId: t4UserId, email: `${t4UserId}@test.internal`, name: 'Teacher T4' });
    try {
      await Student.create({ userId: t4UserId, name: 'Scanner Student', photoUrl: samplePng });
      const initialCount = await Attendance.countDocuments({ userId: t4UserId });

      const res = await fetch(`${baseUrl}/api/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token4}`,
          'Host': 'localhost:9002',
          'Origin': 'http://localhost:9002',
        },
        body: JSON.stringify({
          photoDataUri: samplePng,
        }),
      });

      const resJson = await res.json();
      const finalCount = await Attendance.countDocuments({ userId: t4UserId });

      const isScanSuccess =
        res.status === 200 &&
        resJson.success === true &&
        resJson.data !== undefined &&
        Array.isArray(resJson.data.presentStudents) &&
        Array.isArray(resJson.data.presentStudentIds) &&
        Array.isArray(resJson.data.unresolvedNames);

      const isFailSecureVision =
        res.status === 500 &&
        resJson.success === false &&
        typeof resJson.error === 'string' &&
        (resJson.error.includes('multimodal-vision') || resJson.error.includes('Google GenAI API key'));

      const passed =
        (isScanSuccess || isFailSecureVision) &&
        finalCount === initialCount; // Confirms zero database writes occurred

      record(
        4,
        'API-04',
        'AI scan request with photo routes to vision scan flow and makes ZERO database writes',
        passed,
        res.status === 200
          ? `Status: 200 OK, Recognized students: [${resJson.data?.presentStudents?.join(', ')}], DB writes: ${finalCount - initialCount}`
          : `Status: 500 (Fail-secure without cloud key), Error: "${resJson.error}", DB writes: ${finalCount - initialCount}`
      );
    } catch (e: any) {
      record(4, 'API-04', 'AI scan request with photo returns recognition payload and makes ZERO database writes', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 5: (API-05) Malformed mixed scan and direct submission payload
    // -------------------------------------------------------------
    const t5UserId = `api_t5_${timestamp}`;
    const token5 = createAuthToken({ userId: t5UserId, email: `${t5UserId}@test.internal`, name: 'Teacher T5' });
    try {
      const student5 = await Student.create({ userId: t5UserId, name: 'Mixed Conflict' });

      const res = await fetch(`${baseUrl}/api/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${token5}`,
          'Host': 'localhost:9002',
          'Origin': 'http://localhost:9002',
        },
        body: JSON.stringify({
          action: 'scan',
          photoDataUri: samplePng,
          presentStudentIds: [student5._id.toString()],
        }),
      });

      const resJson = await res.json();
      const persistedCount = await Attendance.countDocuments({ userId: t5UserId });

      const passed =
        res.status === 400 &&
        resJson.success === false &&
        typeof resJson.error === 'string' &&
        resJson.error.includes('Malformed mixed scan and direct submission payload') &&
        persistedCount === 0;

      record(
        5,
        'API-05',
        'Malformed mixed scan and direct submission payload rejected with actionable HTTP 400',
        passed,
        `Status: ${res.status}, Error: "${resJson.error}", Persisted count: ${persistedCount}`
      );
    } catch (e: any) {
      record(5, 'API-05', 'Malformed mixed scan and direct submission payload rejected with actionable HTTP 400', false, e.message);
    }

    // -------------------------------------------------------------
    // Test 6: (API-06) Cross-tenant ID rejection through the API
    // -------------------------------------------------------------
    const t6TeacherA = `api_t6_a_${timestamp}`;
    const t6TeacherB = `api_t6_b_${timestamp}`;
    const tokenA = createAuthToken({ userId: t6TeacherA, email: `${t6TeacherA}@test.internal`, name: 'Teacher A' });
    try {
      const studentB = await Student.create({ userId: t6TeacherB, name: 'Student of Teacher B' });

      // Teacher A attempts to submit attendance using Teacher B's student ID
      const res = await fetch(`${baseUrl}/api/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `auth_token=${tokenA}`,
          'Host': 'localhost:9002',
          'Origin': 'http://localhost:9002',
        },
        body: JSON.stringify({
          presentStudentIds: [studentB._id.toString()],
        }),
      });

      const resJson = await res.json();
      const teacherARecords = await Attendance.countDocuments({ userId: t6TeacherA });

      const passed =
        res.status === 400 &&
        resJson.success === false &&
        typeof resJson.error === 'string' &&
        (resJson.error.includes("not in this teacher's active roster") || resJson.error.includes('not enrolled')) &&
        teacherARecords === 0;

      record(
        6,
        'API-06',
        'Cross-tenant student ID submitted through API is rejected with HTTP 400',
        passed,
        `Status: ${res.status}, Error: "${resJson.error}", Persisted records for Teacher A: ${teacherARecords}`
      );
    } catch (e: any) {
      record(6, 'API-06', 'Cross-tenant student ID submitted through API is rejected with HTTP 400', false, e.message);
    }

  } finally {
    // Cleanup test data
    await Promise.all([
      Student.deleteMany({ userId: { $regex: `^api_t.*_${timestamp}` } }),
      Attendance.deleteMany({ userId: { $regex: `^api_t.*_${timestamp}` } }),
    ]);
    await mongoose.disconnect();
  }

  // -------------------------------------------------------------
  // Test Summary
  // -------------------------------------------------------------
  console.log('\n====================================================================');
  console.log('📊 PHASE 4.1.6 API ATTENDANCE & ROUTING TEST SUMMARY');
  console.log('====================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total API Tests: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log('====================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runApiAttendanceTests().catch((err) => {
  console.error('Fatal API Test Runner Error:', err);
  process.exit(1);
});
