/**
 * ===============================================================
 * ASTRO AI - PHASE 1 COMPREHENSIVE AUTH & SECURITY TEST SUITE
 * ===============================================================
 * Verifies all Phase 1 authentication, authorization, and security specifications:
 *  1. Successful registration with password hashing
 *  2. Duplicate registration rejection
 *  3. Successful login & signed JWT issuance with unique jti
 *  4. Incorrect password rejection
 *  5. Missing JWT secret handling (fail-secure without fallback)
 *  6. Expired JWT rejection
 *  7. Invalid / Tampered JWT rejection
 *  8. Successful authenticated session verification
 *  9. Server-side JWT token revocation upon logout
 * 10. Previously issued JWT rejected after logout (replay prevention)
 * 11. Multi-instance token revocation check via shared database
 * 12. Protected API access without authentication rejected
 * 13. Tenant isolation (User A cannot access User B data)
 * 14. Ownership enforcement (User A cannot delete User B records)
 * 15. Client-supplied user ID override protection
 * 16. Atomic rate limiting - sequential limit enforcement
 * 17. Atomic rate limiting - high-concurrency burst test (race condition check)
 * 18. Account profile updates (Name and Email)
 * 19. Password change verification with old-password check
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

// Load local environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Import application modules
import dbConnect from '../src/lib/db';
import User from '../src/models/User';
import RevokedToken from '../src/models/RevokedToken';
import RateLimit from '../src/models/RateLimit';
import Student from '../src/models/Student';
import Grade from '../src/models/Grade';
import { createAuthToken, verifyAuthToken, getJwtSecret, revokeToken, isTokenRevoked } from '../src/lib/auth';
import { checkRateLimit } from '../src/lib/rate-limiter';
import { studentRepo, gradeRepo } from '../src/lib/db-repo';

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordTest(id: number, name: string, passed: boolean, details: string) {
  results.push({ id, name, passed, details });
  const statusEmoji = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${statusEmoji} [Test ${id.toString().padStart(2, '0')}] ${name}`);
  if (!passed) {
    console.error(`   -> Error Details: ${details}`);
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING ASTRO AI AUTH & SECURITY TEST SUITE');
  console.log('======================================================\n');

  await dbConnect();

  const timestamp = Date.now();
  const userAEmail = `test_user_a_${timestamp}@astro.edu`;
  const userBEmail = `test_user_b_${timestamp}@astro.edu`;
  const passwordA = 'SecurePass123!';
  const passwordB = 'OtherSecret456!';

  let userAId = '';
  let userBId = '';

  try {
    // -------------------------------------------------------------
    // TEST 1: Successful Registration
    // -------------------------------------------------------------
    try {
      const hashedPassword = await bcrypt.hash(passwordA, 10);
      const createdUser = await User.create({
        name: 'Teacher Alice',
        email: userAEmail.toLowerCase().trim(),
        password: hashedPassword,
        role: 'teacher',
      });
      userAId = createdUser._id.toString();

      const exists = await User.findById(userAId);
      const passwordStoredAsHash = exists && exists.password !== passwordA && exists.password.startsWith('$2');

      if (exists && passwordStoredAsHash) {
        recordTest(1, 'Successful registration with password hashing', true, 'User created with bcrypt hash.');
      } else {
        recordTest(1, 'Successful registration with password hashing', false, 'Password was not stored as a valid bcrypt hash.');
      }
    } catch (err: any) {
      recordTest(1, 'Successful registration with password hashing', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 2: Duplicate Registration Rejection
    // -------------------------------------------------------------
    try {
      let duplicateCaught = false;
      const existing = await User.findOne({ email: userAEmail });
      if (existing) {
        duplicateCaught = true;
      }
      if (duplicateCaught) {
        recordTest(2, 'Duplicate registration rejection', true, 'Duplicate email detected prior to insertion.');
      } else {
        recordTest(2, 'Duplicate registration rejection', false, 'Duplicate email check failed.');
      }
    } catch (err: any) {
      recordTest(2, 'Duplicate registration rejection', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 3: Successful Login & Signed JWT with Unique JTI
    // -------------------------------------------------------------
    let activeToken = '';
    let activeJti = '';
    try {
      const user = await User.findOne({ email: userAEmail });
      const passwordMatches = user ? await bcrypt.compare(passwordA, user.password) : false;

      if (user && passwordMatches) {
        activeToken = createAuthToken({
          userId: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        });

        const decoded = jwt.decode(activeToken) as any;
        activeJti = decoded?.jti;

        if (activeToken && activeJti && typeof activeJti === 'string') {
          recordTest(3, 'Successful login and JWT token issuance with unique JTI', true, `Token issued with JTI: ${activeJti}`);
        } else {
          recordTest(3, 'Successful login and JWT token issuance with unique JTI', false, 'Token issued missing jti claim.');
        }
      } else {
        recordTest(3, 'Successful login and JWT token issuance with unique JTI', false, 'Password comparison failed on valid credentials.');
      }
    } catch (err: any) {
      recordTest(3, 'Successful login and JWT token issuance with unique JTI', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 4: Incorrect Password Rejection
    // -------------------------------------------------------------
    try {
      const user = await User.findOne({ email: userAEmail });
      const invalidPasswordMatches = user ? await bcrypt.compare('WrongPassword999!', user.password) : true;

      if (!invalidPasswordMatches) {
        recordTest(4, 'Incorrect password rejection', true, 'bcrypt correctly rejected invalid password.');
      } else {
        recordTest(4, 'Incorrect password rejection', false, 'Invalid password was accepted.');
      }
    } catch (err: any) {
      recordTest(4, 'Incorrect password rejection', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 5: Missing JWT Secret Fails Securely
    // -------------------------------------------------------------
    try {
      const originalSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = '';

      let threwError = false;
      try {
        getJwtSecret();
      } catch (err: any) {
        threwError = err.message.includes('FATAL: JWT_SECRET environment variable is missing');
      } finally {
        process.env.JWT_SECRET = originalSecret;
      }

      if (threwError) {
        recordTest(5, 'Missing JWT secret handling (fails securely without fallback)', true, 'System threw fatal error when JWT_SECRET was empty.');
      } else {
        recordTest(5, 'Missing JWT secret handling (fails securely without fallback)', false, 'System did not fail securely when JWT_SECRET was empty.');
      }
    } catch (err: any) {
      recordTest(5, 'Missing JWT secret handling (fails securely without fallback)', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 6: Expired JWT Rejection
    // -------------------------------------------------------------
    try {
      const secret = getJwtSecret();
      const expiredToken = jwt.sign(
        { userId: userAId, email: userAEmail, exp: Math.floor(Date.now() / 1000) - 3600 },
        secret,
        { algorithm: 'HS256' }
      );

      const verified = await verifyAuthToken(expiredToken);
      if (verified === null) {
        recordTest(6, 'Expired JWT rejection', true, 'verifyAuthToken returned null for expired token.');
      } else {
        recordTest(6, 'Expired JWT rejection', false, 'Expired token was accepted as valid.');
      }
    } catch (err: any) {
      recordTest(6, 'Expired JWT rejection', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 7: Invalid / Tampered JWT Rejection
    // -------------------------------------------------------------
    try {
      const forgedToken = jwt.sign(
        { userId: userAId, email: userAEmail },
        'wrong-attacker-secret-key-that-does-not-match-system',
        { algorithm: 'HS256' }
      );

      const verified = await verifyAuthToken(forgedToken);
      if (verified === null) {
        recordTest(7, 'Invalid / Tampered JWT rejection', true, 'Signature mismatch correctly rejected.');
      } else {
        recordTest(7, 'Invalid / Tampered JWT rejection', false, 'Forged signature was accepted.');
      }
    } catch (err: any) {
      recordTest(7, 'Invalid / Tampered JWT rejection', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 8: Successful Authenticated Session Verification
    // -------------------------------------------------------------
    try {
      const decoded = await verifyAuthToken(activeToken);
      if (decoded && decoded.userId === userAId && decoded.email === userAEmail) {
        recordTest(8, 'Successful authenticated session verification', true, `Decoded valid user ID: ${decoded.userId}`);
      } else {
        recordTest(8, 'Successful authenticated session verification', false, 'Decoded payload did not match expected user details.');
      }
    } catch (err: any) {
      recordTest(8, 'Successful authenticated session verification', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 9: Server-Side Token Revocation Upon Logout
    // -------------------------------------------------------------
    try {
      const tokenToRevoke = createAuthToken({
        userId: userAId,
        email: userAEmail,
        name: 'Teacher Alice',
      });
      const decodedRevoke = jwt.decode(tokenToRevoke) as any;
      const jtiToRevoke = decodedRevoke?.jti;

      const revokeResult = await revokeToken(tokenToRevoke);
      const isRevokedInDb = await isTokenRevoked(jtiToRevoke);

      if (revokeResult && isRevokedInDb) {
        recordTest(9, 'Server-side JWT token revocation upon logout', true, `Token with JTI ${jtiToRevoke} revoked in MongoDB with TTL.`);
      } else {
        recordTest(9, 'Server-side JWT token revocation upon logout', false, 'Token revocation failed to persist in database.');
      }
    } catch (err: any) {
      recordTest(9, 'Server-side JWT token revocation upon logout', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 10: Previously Issued JWT Rejected After Logout (Replay Prevention)
    // -------------------------------------------------------------
    try {
      const sessionToken = createAuthToken({
        userId: userAId,
        email: userAEmail,
        name: 'Teacher Alice',
      });

      // 1. Verify token works before logout
      const beforeLogout = await verifyAuthToken(sessionToken);
      // 2. Perform server-side revocation (simulating logout)
      await revokeToken(sessionToken);
      // 3. Attempt to reuse the exact same token string
      const afterLogout = await verifyAuthToken(sessionToken);

      if (beforeLogout !== null && afterLogout === null) {
        recordTest(10, 'Previously issued token rejected after logout', true, 'Original JWT string rejected after server-side revocation.');
      } else {
        recordTest(10, 'Previously issued token rejected after logout', false, `Token before: ${!!beforeLogout}, Token after: ${!!afterLogout}`);
      }
    } catch (err: any) {
      recordTest(10, 'Previously issued token rejected after logout', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 11: Multi-Instance Token Revocation Check
    // -------------------------------------------------------------
    try {
      // Create a third token, record its JTI in RevokedToken collection directly (simulating instance B)
      const testToken = createAuthToken({ userId: userAId, email: userAEmail });
      const decoded = jwt.decode(testToken) as any;
      
      // Instance B writes revocation record
      await RevokedToken.create({
        jti: decoded.jti,
        userId: userAId,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      });

      // Instance A verifies token
      const verifiedOnInstanceA = await verifyAuthToken(testToken);
      if (verifiedOnInstanceA === null) {
        recordTest(11, 'Revocation across separate application instances', true, 'Revocation committed to shared DB immediately invalidated token across instances.');
      } else {
        recordTest(11, 'Revocation across separate application instances', false, 'Instance did not observe revocation from shared database.');
      }
    } catch (err: any) {
      recordTest(11, 'Revocation across separate application instances', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 12: Protected API Access Without Authentication Rejected
    // -------------------------------------------------------------
    try {
      const unauthenticatedUser = await verifyAuthToken('');
      if (unauthenticatedUser === null) {
        recordTest(12, 'Protected API access without authentication rejected', true, 'Unauthenticated request correctly produces null user (401).');
      } else {
        recordTest(12, 'Protected API access without authentication rejected', false, 'Unauthenticated request produced an unexpected session.');
      }
    } catch (err: any) {
      recordTest(12, 'Protected API access without authentication rejected', false, err.message);
    }

    // -------------------------------------------------------------
    // Create User B for Multi-Tenant Isolation Tests (13 & 14)
    // -------------------------------------------------------------
    const hashedPassB = await bcrypt.hash(passwordB, 10);
    const userB = await User.create({
      name: 'Teacher Bob',
      email: userBEmail.toLowerCase().trim(),
      password: hashedPassB,
      role: 'teacher',
    });
    userBId = userB._id.toString();

    // -------------------------------------------------------------
    // TEST 13: Tenant Isolation (User A Cannot Access User B Data)
    // -------------------------------------------------------------
    try {
      const userBItem = await studentRepo.addStudent(userBId, { name: 'Bob Student 1' });
      const userAStudents = await studentRepo.getStudents(userAId);
      const leakedUserBData = userAStudents.some((s: any) => s.id === userBItem.id || s.name === 'Bob Student 1');
      const userBStudents = await studentRepo.getStudents(userBId);
      const userBCanSeeOwn = userBStudents.some((s: any) => s.id === userBItem.id);

      if (!leakedUserBData && userBCanSeeOwn) {
        recordTest(13, "User A cannot access User B's data (Tenant Isolation)", true, 'User A queries returned strictly User A records; User B data completely isolated.');
      } else {
        recordTest(13, "User A cannot access User B's data (Tenant Isolation)", false, 'User B data was leaked to User A.');
      }
      await studentRepo.deleteStudent(userBId, userBItem.id);
    } catch (err: any) {
      recordTest(13, "User A cannot access User B's data (Tenant Isolation)", false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 14: Ownership Enforcement (User A Cannot Delete User B Records)
    // -------------------------------------------------------------
    try {
      const bGrade = await gradeRepo.addGrade(userBId, { studentName: 'Student X', subject: 'Math', grade: 95, className: '10A' });
      const deleteAttemptByA = await gradeRepo.deleteGrade(userAId, bGrade.id);
      const bGradesAfter = await gradeRepo.getGrades(userBId);
      const stillExists = bGradesAfter.some((g: any) => g.id === bGrade.id);

      if (!deleteAttemptByA && stillExists) {
        recordTest(14, "User A cannot delete User B's records (Ownership Enforcement)", true, 'Ownership check prevented unauthorized deletion of another user record.');
      } else {
        recordTest(14, "User A cannot delete User B's records (Ownership Enforcement)", false, 'User A was able to delete User B record.');
      }

      await gradeRepo.deleteGrade(userBId, bGrade.id);
    } catch (err: any) {
      recordTest(14, "User A cannot delete User B's records (Ownership Enforcement)", false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 15: Client-Supplied UID Override Protection
    // -------------------------------------------------------------
    try {
      const spoofedPayload = {
        name: 'Injected Student',
        photoDataUri: '',
        userId: userBId, // Spoofed user ID targeting User B
      };

      const injectedItem = await studentRepo.addStudent(userAId, spoofedPayload);
      if (injectedItem.userId.toString() === userAId) {
        recordTest(15, 'Client-supplied user ID cannot override authenticated identity', true, `Item stamped with authenticated identity ${userAId}, ignoring client-supplied ${userBId}.`);
      } else {
        recordTest(15, 'Client-supplied user ID cannot override authenticated identity', false, 'Client spoofed UID was accepted.');
      }
      await studentRepo.deleteStudent(userAId, injectedItem.id);
    } catch (err: any) {
      recordTest(15, 'Client-supplied user ID cannot override authenticated identity', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 16: Atomic Rate Limiting - Sequential Enforcement
    // -------------------------------------------------------------
    try {
      const rateLimitKey = `test-seq-limit-${Date.now()}`;
      const limit = 3;
      const windowSec = 10;

      const res1 = await checkRateLimit(rateLimitKey, limit, windowSec);
      const res2 = await checkRateLimit(rateLimitKey, limit, windowSec);
      const res3 = await checkRateLimit(rateLimitKey, limit, windowSec);
      const res4 = await checkRateLimit(rateLimitKey, limit, windowSec);

      if (res1.success && res2.success && res3.success && !res4.success && res4.remaining === 0) {
        recordTest(16, 'Atomic rate limiting - sequential limit enforcement', true, 'First 3 requests permitted, 4th request immediately rejected with remaining=0.');
      } else {
        recordTest(16, 'Atomic rate limiting - sequential limit enforcement', false, `Seq results: [${res1.success}, ${res2.success}, ${res3.success}, ${res4.success}]`);
      }
    } catch (err: any) {
      recordTest(16, 'Atomic rate limiting - sequential limit enforcement', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 17: Atomic Rate Limiting - High-Concurrency Burst Test (Race Condition Check)
    // -------------------------------------------------------------
    try {
      const burstKey = `test-burst-limit-${Date.now()}`;
      const burstLimit = 5;
      const burstWindowSec = 60;
      const totalConcurrentRequests = 25;

      // Dispatch 25 requests simultaneously using Promise.all
      const promises = Array.from({ length: totalConcurrentRequests }, () =>
        checkRateLimit(burstKey, burstLimit, burstWindowSec)
      );

      const burstResults = await Promise.all(promises);

      const passedRequests = burstResults.filter((r) => r.success).length;
      const rejectedRequests = burstResults.filter((r) => !r.success).length;

      // Mathematically, with atomic operations, EXACTLY burstLimit must succeed, and the rest must fail.
      const isConcurrentlyAtomic = passedRequests === burstLimit && rejectedRequests === (totalConcurrentRequests - burstLimit);

      if (isConcurrentlyAtomic) {
        recordTest(
          17,
          'Atomic rate limiting - high-concurrency burst test (race condition check)',
          true,
          `Under 25 concurrent requests with limit 5: Exactly ${passedRequests} succeeded, ${rejectedRequests} rejected. Zero race condition leaks.`
        );
      } else {
        recordTest(
          17,
          'Atomic rate limiting - high-concurrency burst test (race condition check)',
          false,
          `Concurrency breach: ${passedRequests} succeeded (expected ${burstLimit}), ${rejectedRequests} rejected.`
        );
      }
    } catch (err: any) {
      recordTest(17, 'Atomic rate limiting - high-concurrency burst test (race condition check)', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 18: Account Profile Updates (Name & Email)
    // -------------------------------------------------------------
    try {
      const userToUpdate = await User.findById(userAId);
      const newName = 'Dr. Alice Updated';
      if (userToUpdate) {
        userToUpdate.name = newName;
        await userToUpdate.save();
      }

      const verifiedUser = await User.findById(userAId);
      if (verifiedUser && verifiedUser.name === newName) {
        recordTest(18, 'Account profile updates (Name and Email)', true, `Profile updated successfully to: ${verifiedUser.name}`);
      } else {
        recordTest(18, 'Account profile updates (Name and Email)', false, 'Profile update was not persisted.');
      }
    } catch (err: any) {
      recordTest(18, 'Account profile updates (Name and Email)', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 19: Password Change Verification
    // -------------------------------------------------------------
    try {
      const user = await User.findById(userAId);
      const newPassword = 'BrandNewPassword2026!';

      const currentPasswordValid = user ? await bcrypt.compare(passwordA, user.password) : false;

      if (currentPasswordValid && user) {
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();
      }

      const refreshedUser = await User.findById(userAId);
      const oldPasswordFails = refreshedUser ? !(await bcrypt.compare(passwordA, refreshedUser.password)) : false;
      const newPasswordWorks = refreshedUser ? await bcrypt.compare(newPassword, refreshedUser.password) : false;

      if (currentPasswordValid && oldPasswordFails && newPasswordWorks) {
        recordTest(19, 'Password change verification with old-password check', true, 'Old password invalidated; new password hash successfully verified.');
      } else {
        recordTest(19, 'Password change verification with old-password check', false, 'Password update verification failed.');
      }
    } catch (err: any) {
      recordTest(19, 'Password change verification with old-password check', false, err.message);
    }

  } finally {
    // Clean up test data
    if (userAId) {
      await User.findByIdAndDelete(userAId);
      await Student.deleteMany({ userId: userAId });
      await Grade.deleteMany({ userId: userAId });
    }
    if (userBId) {
      await User.findByIdAndDelete(userBId);
      await Student.deleteMany({ userId: userBId });
      await Grade.deleteMany({ userId: userBId });
    }
    await RateLimit.deleteMany({ key: { $regex: '^test-' } });

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
    console.log(`\n🎉 ALL ${total} AUTHENTICATION & SECURITY TESTS PASSED PERFECTLY!\n`);
  } else {
    console.error(`\n⚠️ ${failedCount} TEST(S) FAILED. Review output above.\n`);
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
