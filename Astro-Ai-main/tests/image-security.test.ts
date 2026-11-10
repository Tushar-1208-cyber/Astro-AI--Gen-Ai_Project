/**
 * ===============================================================
 * ASTRO AI - IMAGE STORAGE OWNERSHIP & SECURITY TEST SUITE
 * ===============================================================
 * Verifies all Phase 2 image security specifications via live HTTP:
 *  1. User A can access their own student image (HTTP 200)
 *  2. User B cannot access User A's student image (BOLA / IDOR defense: HTTP 404)
 *  3. User A can access their own attendance image (HTTP 200)
 *  4. User B cannot access User A's attendance image (BOLA / IDOR defense: HTTP 404)
 *  5. Cache policy verification: Cache-Control must be 'private, no-store'
 *  6. Suffix-only filename match is rejected (Strict exact canonical equality)
 *  7. Regex-special characters in filename cannot bypass ownership checks
 *  8. Image referenced only by an unrelated URL is rejected (HTTP 404)
 *  9. Unauthenticated image access is rejected (HTTP 401)
 * 10. Revoked token image access is rejected (HTTP 401)
 * 11. Orphaned image on disk without database owner returns 404
 * 12. Deleted image references cannot be accessed (HTTP 404)
 * 13. Updated image references cannot expose old files (HTTP 404)
 * 14. Path traversal attempts are blocked (HTTP 400 or 404)
 * 15. Malformed image path requests are rejected (HTTP 400)
 * 16. MIME type spoofing is rejected by storage layer
 * 17. Oversized files (> 5MB) are rejected by storage layer
 * 18. Existing student & attendance workflows save and serve valid images
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import dbConnect from '../src/lib/db';
import User from '../src/models/User';
import Student from '../src/models/Student';
import Attendance from '../src/models/Attendance';
import RevokedToken from '../src/models/RevokedToken';
import { createAuthToken, revokeToken } from '../src/lib/auth';
import { saveBase64Image, deleteStoredImage } from '../src/lib/storage';
import { studentRepo, attendanceRepo } from '../src/lib/db-repo';

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordTest(id: number, name: string, passed: boolean, details: string) {
  results.push({ id, name, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} [Test ${String(id).padStart(2, '0')}] ${name}`);
  if (!passed) {
    console.error(`   👉 Details: ${details}`);
  }
}

async function runImageSecurityTests() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING ASTRO AI IMAGE STORAGE SECURITY TEST SUITE');
  console.log('======================================================\n');

  await dbConnect();

  const baseUrl = process.env.TEST_APP_URL || 'http://localhost:9002';

  // Test setup variables
  let userAId = '';
  let userBId = '';
  let tokenA = '';
  let tokenB = '';
  let studentAUrl = '';
  let attendanceAUrl = '';
  let studentAId = '';
  let attendanceAId = '';
  let orphanedUrl = '';

  const samplePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  try {
    // -------------------------------------------------------------
    // SETUP: Create two distinct authenticated users
    // -------------------------------------------------------------
    const hashedPassword = await bcrypt.hash('TestPass123!', 10);
    const userA = await User.create({
      name: 'Teacher Alice',
      email: `alice_${Date.now()}@test.com`,
      password: hashedPassword,
      role: 'teacher',
    });
    userAId = userA._id.toString();

    const userB = await User.create({
      name: 'Teacher Bob',
      email: `bob_${Date.now()}@test.com`,
      password: hashedPassword,
      role: 'teacher',
    });
    userBId = userB._id.toString();

    tokenA = createAuthToken({
      userId: userAId,
      email: userA.email,
      name: userA.name,
      role: userA.role,
    });

    tokenB = createAuthToken({
      userId: userBId,
      email: userB.email,
      name: userB.name,
      role: userB.role,
    });

    // Create Student for User A with Photo
    const studentA = await studentRepo.addStudent(userAId, {
      name: 'Alice Student 1',
      photoDataUri: samplePng,
    });
    studentAId = studentA.id;
    studentAUrl = studentA.photoUrl;

    // Create Attendance for User A with Photo
    const attendanceA = await attendanceRepo.addAttendance(userAId, {
      date: new Date(),
      presentStudents: ['Alice Student 1'],
      photoDataUri: samplePng,
    });
    attendanceAId = attendanceA.id;
    attendanceAUrl = attendanceA.photoUrl || '';

    // Create an orphaned image directly on disk (no DB record)
    const orphanedStored = await saveBase64Image(samplePng, 'students', 'orphaned_test');
    orphanedUrl = orphanedStored.url;

    // -------------------------------------------------------------
    // TEST 1: User A Can Access Their Own Student Image
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${baseUrl}${studentAUrl}`, {
        headers: { Cookie: `auth_token=${tokenA}` },
      });
      const passed = res.status === 200 && res.headers.get('content-type')?.includes('image/png');
      recordTest(1, 'User A can access their own student image', !!passed, `HTTP Status: ${res.status}`);
    } catch (err: any) {
      recordTest(1, 'User A can access their own student image', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 2: User B Cannot Access User A's Student Image (BOLA / IDOR)
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${baseUrl}${studentAUrl}`, {
        headers: { Cookie: `auth_token=${tokenB}` },
      });
      const passed = res.status === 404; // 404 prevents information disclosure
      recordTest(2, "User B cannot access User A's student image (BOLA / IDOR Defense)", passed, `HTTP Status: ${res.status} (Expected 404)`);
    } catch (err: any) {
      recordTest(2, "User B cannot access User A's student image (BOLA / IDOR Defense)", false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 3: User A Can Access Their Own Attendance Image
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${baseUrl}${attendanceAUrl}`, {
        headers: { Cookie: `auth_token=${tokenA}` },
      });
      const passed = res.status === 200 && res.headers.get('content-type')?.includes('image/png');
      recordTest(3, 'User A can access their own attendance image', !!passed, `HTTP Status: ${res.status}`);
    } catch (err: any) {
      recordTest(3, 'User A can access their own attendance image', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 4: User B Cannot Access User A's Attendance Image (BOLA / IDOR)
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${baseUrl}${attendanceAUrl}`, {
        headers: { Cookie: `auth_token=${tokenB}` },
      });
      const passed = res.status === 404;
      recordTest(4, "User B cannot access User A's attendance image (BOLA / IDOR Defense)", passed, `HTTP Status: ${res.status} (Expected 404)`);
    } catch (err: any) {
      recordTest(4, "User B cannot access User A's attendance image (BOLA / IDOR Defense)", false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 5: Cache Policy Verification (Cache-Control: private, no-store)
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${baseUrl}${studentAUrl}`, {
        headers: { Cookie: `auth_token=${tokenA}` },
      });
      const cacheControl = res.headers.get('cache-control') || '';
      const passed = cacheControl.includes('private') && cacheControl.includes('no-store');
      recordTest(5, 'Private image cache policy is non-persistent (private, no-store)', passed, `Cache-Control: "${cacheControl}"`);
    } catch (err: any) {
      recordTest(5, 'Private image cache policy is non-persistent (private, no-store)', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 6: Suffix-Only Match is Rejected (No Permissive Regex Fallback)
    // -------------------------------------------------------------
    try {
      // User B registers a student whose photoUrl has an overlapping suffix of User A's file
      const rawAFilename = path.basename(studentAUrl);
      const spoofedSuffixUrl = `/api/storage/students/prefix_${rawAFilename}`;
      const userBStudent = await Student.create({
        userId: userBId,
        name: 'Spoof Suffix Student',
        photoUrl: spoofedSuffixUrl,
      });

      // User B attempts to access User A's exact image URL (which ends with rawAFilename)
      const res = await fetch(`${baseUrl}${studentAUrl}`, {
        headers: { Cookie: `auth_token=${tokenB}` },
      });
      // Must be 404 because User B's record is prefix_... not exact studentAUrl
      const passed = res.status === 404;
      recordTest(6, 'Suffix-only filename match is rejected (Strict exact canonical check)', passed, `HTTP Status: ${res.status} (Expected 404)`);

      await Student.findByIdAndDelete(userBStudent._id);
    } catch (err: any) {
      recordTest(6, 'Suffix-only filename match is rejected (Strict exact canonical check)', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 7: Regex-Special Characters in Filename Cannot Bypass Checks
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${baseUrl}/api/storage/students/.*.png`, {
        headers: { Cookie: `auth_token=${tokenA}` },
      });
      const passed = res.status === 404 || res.status === 400;
      recordTest(7, 'Regex-special characters in filename cannot bypass ownership checks', passed, `HTTP Status: ${res.status} (Expected 400 or 404)`);
    } catch (err: any) {
      recordTest(7, 'Regex-special characters in filename cannot bypass ownership checks', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 8: Image Referenced Only by an Unrelated URL is Rejected
    // -------------------------------------------------------------
    try {
      const savedSpecial = await saveBase64Image(samplePng, 'students', 'unrelated_test');
      const filename = path.basename(savedSpecial.url);

      // Create student with an unrelated external URL
      const studentUnrelated = await Student.create({
        userId: userAId,
        name: 'Unrelated URL Student',
        photoUrl: `https://example.com/external/${filename}`,
      });

      // User A attempts to request via /api/storage/students/${filename}
      const res = await fetch(`${baseUrl}/api/storage/students/${filename}`, {
        headers: { Cookie: `auth_token=${tokenA}` },
      });
      const passed = res.status === 404;
      recordTest(8, 'Image referenced only by an unrelated URL is rejected', passed, `HTTP Status: ${res.status} (Expected 404)`);

      await Student.findByIdAndDelete(studentUnrelated._id);
      await deleteStoredImage(savedSpecial.url, 'students');
    } catch (err: any) {
      recordTest(8, 'Image referenced only by an unrelated URL is rejected', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 9: Unauthenticated Image Access is Rejected
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${baseUrl}${studentAUrl}`);
      const passed = res.status === 401;
      recordTest(9, 'Unauthenticated image access is rejected with 401', passed, `HTTP Status: ${res.status}`);
    } catch (err: any) {
      recordTest(9, 'Unauthenticated image access is rejected with 401', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 10: Revoked Token Image Access is Rejected
    // -------------------------------------------------------------
    try {
      const revokedToken = createAuthToken({
        userId: userAId,
        email: userA.email,
        name: userA.name,
        role: userA.role,
      });
      await revokeToken(revokedToken);

      const res = await fetch(`${baseUrl}${studentAUrl}`, {
        headers: { Cookie: `auth_token=${revokedToken}` },
      });
      const passed = res.status === 401;
      recordTest(10, 'Revoked token image access is rejected with 401', passed, `HTTP Status: ${res.status}`);
    } catch (err: any) {
      recordTest(10, 'Revoked token image access is rejected with 401', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 11: Orphaned Image Access Without DB Record is Rejected
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${baseUrl}${orphanedUrl}`, {
        headers: { Cookie: `auth_token=${tokenA}` },
      });
      const passed = res.status === 404;
      recordTest(11, 'Orphaned image on disk without database owner returns 404', passed, `HTTP Status: ${res.status} (Expected 404)`);
    } catch (err: any) {
      recordTest(11, 'Orphaned image on disk without database owner returns 404', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 12: Deleted Image References Cannot Be Accessed
    // -------------------------------------------------------------
    try {
      const studentToDelete = await studentRepo.addStudent(userAId, {
        name: 'Ephemeral Student',
        photoDataUri: samplePng,
      });
      const deletedUrl = studentToDelete.photoUrl;
      await studentRepo.deleteStudent(userAId, studentToDelete.id);

      const res = await fetch(`${baseUrl}${deletedUrl}`, {
        headers: { Cookie: `auth_token=${tokenA}` },
      });
      const passed = res.status === 404;
      recordTest(12, 'Deleted student image reference returns 404', passed, `HTTP Status: ${res.status}`);
    } catch (err: any) {
      recordTest(12, 'Deleted student image reference returns 404', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 13: Updated Image References Cannot Expose Old Files
    // -------------------------------------------------------------
    try {
      const studentToUpdate = await studentRepo.addStudent(userAId, {
        name: 'Updating Student',
        photoDataUri: samplePng,
      });
      const oldUrl = studentToUpdate.photoUrl;

      // Update student with a second image
      const newSamplePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const updatedStudent = await studentRepo.updateStudent(userAId, studentToUpdate.id, {
        photoDataUri: newSamplePng,
      });

      const resOld = await fetch(`${baseUrl}${oldUrl}`, {
        headers: { Cookie: `auth_token=${tokenA}` },
      });
      const resNew = await fetch(`${baseUrl}${updatedStudent!.photoUrl}`, {
        headers: { Cookie: `auth_token=${tokenA}` },
      });

      const passed = resOld.status === 404 && resNew.status === 200;
      recordTest(13, 'Updated image reference disallows old URL and allows new URL', passed, `Old: HTTP ${resOld.status}, New: HTTP ${resNew.status}`);

      await studentRepo.deleteStudent(userAId, studentToUpdate.id);
    } catch (err: any) {
      recordTest(13, 'Updated image reference disallows old URL and allows new URL', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 14: Path Traversal Attempts Are Blocked
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${baseUrl}/api/storage/students/..%2F..%2Fpackage.json`, {
        headers: { Cookie: `auth_token=${tokenA}` },
      });
      const passed = res.status === 400 || res.status === 404;
      recordTest(14, 'Path traversal request is rejected', passed, `HTTP Status: ${res.status}`);
    } catch (err: any) {
      recordTest(14, 'Path traversal request is rejected', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 15: Malformed Image Paths Are Rejected
    // -------------------------------------------------------------
    try {
      const res = await fetch(`${baseUrl}/api/storage/invalidpathonly`, {
        headers: { Cookie: `auth_token=${tokenA}` },
      });
      const passed = res.status === 400;
      recordTest(15, 'Malformed image path returns 400 Bad Request', passed, `HTTP Status: ${res.status}`);
    } catch (err: any) {
      recordTest(15, 'Malformed image path returns 400 Bad Request', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 16: MIME Type Spoofing Rejection
    // -------------------------------------------------------------
    try {
      let threw = false;
      try {
        await saveBase64Image('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', 'students');
      } catch (e: any) {
        if (e.message.includes('Unsupported image MIME type')) threw = true;
      }
      recordTest(16, 'MIME type spoofing rejection in storage engine', threw, 'Invalid HTML MIME was rejected.');
    } catch (err: any) {
      recordTest(16, 'MIME type spoofing rejection in storage engine', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 17: File Size (> 5MB) Validation
    // -------------------------------------------------------------
    try {
      let threw = false;
      try {
        const bigBuffer = Buffer.alloc(6 * 1024 * 1024, 0);
        await saveBase64Image(`data:image/jpeg;base64,${bigBuffer.toString('base64')}`, 'students');
      } catch (e: any) {
        if (e.message.includes('exceeds 5MB limit')) threw = true;
      }
      recordTest(17, 'Oversized file (>5MB) rejection in storage engine', threw, '6MB payload was rejected.');
    } catch (err: any) {
      recordTest(17, 'Oversized file (>5MB) rejection in storage engine', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 18: Existing Roster & Attendance Workflows Still Work
    // -------------------------------------------------------------
    try {
      const studentList = await studentRepo.getStudents(userAId);
      const studentFound = studentList.some((s) => s.id === studentAId && s.photoUrl === studentAUrl);

      const attendanceList = await attendanceRepo.getAttendance(userAId);
      const attendanceFound = attendanceList.some((a) => a.id === attendanceAId && a.photoUrl === attendanceAUrl);

      const passed = studentFound && attendanceFound;
      recordTest(18, 'Existing student & attendance workflows save and serve valid images', passed, 'Roster and attendance records successfully query and retrieve valid image paths.');
    } catch (err: any) {
      recordTest(18, 'Existing student & attendance workflows save and serve valid images', false, err.message);
    }

  } finally {
    // Clean up test data
    if (userAId) {
      await User.findByIdAndDelete(userAId);
      await Student.deleteMany({ userId: userAId });
      await Attendance.deleteMany({ userId: userAId });
      await RevokedToken.deleteMany({ userId: userAId });
    }
    if (userBId) {
      await User.findByIdAndDelete(userBId);
      await Student.deleteMany({ userId: userBId });
      await Attendance.deleteMany({ userId: userBId });
      await RevokedToken.deleteMany({ userId: userBId });
    }
    if (studentAUrl) {
      await deleteStoredImage(studentAUrl, 'students');
    }
    if (attendanceAUrl) {
      await deleteStoredImage(attendanceAUrl, 'attendance');
    }
    if (orphanedUrl) {
      await deleteStoredImage(orphanedUrl, 'students');
    }

    await mongoose.disconnect();
  }

  console.log('\n======================================================');
  console.log('📊 TEST SUMMARY RESULTS');
  console.log('======================================================');
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = total - passedCount;

  console.log(`Total Executed: ${total}`);
  console.log(`Passed:         ${passedCount}`);
  console.log(`Failed:         ${failedCount}`);

  if (failedCount === 0) {
    console.log(`\n🎉 ALL ${total} IMAGE STORAGE & SECURITY TESTS PASSED PERFECTLY!\n`);
  } else {
    console.error(`\n⚠️ ${failedCount} TEST(S) FAILED. Review output above.\n`);
    process.exit(1);
  }
}

runImageSecurityTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
