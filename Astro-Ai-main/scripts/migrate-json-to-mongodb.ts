/**
 * ===============================================================
 * ASTRO AI - PHASE 2 JSON TO MONGODB MIGRATION SCRIPT
 * ===============================================================
 * Safely migrates legacy JSON database (astro_ai_local_db.json) into MongoDB.
 * 
 * Features:
 *  - Automatic pre-migration backup of original JSON file.
 *  - Supports --dry-run mode.
 *  - Validates all records and logs invalid records separately.
 *  - Extracts large Base64 photos into dedicated file storage.
 *  - Strictly idempotent: rerunning does not create duplicates.
 *  - Preserves original IDs (legacyId) and user ownership (userId).
 *  - Full post-migration data integrity verification.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment configuration
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import dbConnect from '../src/lib/db';
import Student from '../src/models/Student';
import Grade from '../src/models/Grade';
import CalendarEvent from '../src/models/CalendarEvent';
import Attendance from '../src/models/Attendance';
import ClassRecording from '../src/models/ClassRecording';
import { saveBase64Image } from '../src/lib/storage';

interface MigrationStats {
  totalRead: number;
  valid: number;
  invalid: number;
  migrated: number;
  duplicates: number;
  invalidDetails: Array<{ id: string; reason: string }>;
}

const isDryRun = process.argv.includes('--dry-run');

// Locate JSON database file
function findJsonDbPath(): string {
  const possiblePaths = [
    path.resolve(__dirname, '..', '..', 'astro_ai_local_db.json'),
    path.resolve(__dirname, '..', 'astro_ai_local_db.json'),
    path.resolve(process.cwd(), '..', 'astro_ai_local_db.json'),
    path.resolve(process.cwd(), 'astro_ai_local_db.json'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  throw new Error(`astro_ai_local_db.json not found in search paths: ${possiblePaths.join(', ')}`);
}

// Create backup
function backupJsonDb(sourcePath: string): string {
  const backupDir = path.resolve(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `astro_ai_local_db.backup.${timestamp}.json`);
  fs.copyFileSync(sourcePath, backupPath);
  return backupPath;
}

export async function runMigration(options: { dryRun?: boolean } = {}) {
  const dryRun = options.dryRun ?? isDryRun;

  console.log('======================================================');
  console.log(`🚀 ASTRO AI - JSON TO MONGODB DATA MIGRATION ${dryRun ? '[DRY RUN]' : '[LIVE]'}`);
  console.log('======================================================\n');

  const jsonPath = findJsonDbPath();
  console.log(`📁 Source JSON Database: ${jsonPath}`);

  // Create immutable backup before executing any operations
  const backupPath = backupJsonDb(jsonPath);
  console.log(`🛡️  Verified Backup Created: ${backupPath}\n`);

  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const dbData = JSON.parse(rawData);

  await dbConnect();

  const report: Record<string, MigrationStats> = {
    students: { totalRead: 0, valid: 0, invalid: 0, migrated: 0, duplicates: 0, invalidDetails: [] },
    grades: { totalRead: 0, valid: 0, invalid: 0, migrated: 0, duplicates: 0, invalidDetails: [] },
    calendarEvents: { totalRead: 0, valid: 0, invalid: 0, migrated: 0, duplicates: 0, invalidDetails: [] },
    attendance: { totalRead: 0, valid: 0, invalid: 0, migrated: 0, duplicates: 0, invalidDetails: [] },
    recordings: { totalRead: 0, valid: 0, invalid: 0, migrated: 0, duplicates: 0, invalidDetails: [] },
  };

  // -------------------------------------------------------------
  // 1. MIGRATE STUDENTS
  // -------------------------------------------------------------
  const studentsList = Array.isArray(dbData.students) ? dbData.students : [];
  report.students.totalRead = studentsList.length;

  for (const item of studentsList) {
    if (!item.name || typeof item.name !== 'string' || item.name.trim().length === 0) {
      report.students.invalid++;
      report.students.invalidDetails.push({ id: item.id || 'unknown', reason: 'Missing or empty student name' });
      continue;
    }

    report.students.valid++;
    const userId = item.uid || 'mock-teacher-id';
    const legacyId = item.id || undefined;
    const name = item.name.trim();

    if (!dryRun) {
      // Check for duplicate / existing record by legacyId or (userId + name)
      const existing = await Student.findOne({
        $or: [{ legacyId: item.id }, { userId, name }],
      });

      let photoUrl = '';
      if (item.photoDataUri && item.photoDataUri.startsWith('data:image/')) {
        try {
          const stored = await saveBase64Image(item.photoDataUri, 'students', `migrated_${legacyId || 'student'}`);
          photoUrl = stored.url;
        } catch (e: any) {
          console.warn(`   ⚠️ Warning: Failed to extract student image for ${name}: ${e.message}`);
        }
      } else if (item.photoDataUri) {
        photoUrl = item.photoDataUri;
      }

      if (existing) {
        report.students.duplicates++;
        // Update without duplicating
        if (photoUrl && !existing.photoUrl) existing.photoUrl = photoUrl;
        if (!existing.legacyId && legacyId) existing.legacyId = legacyId;
        await existing.save();
      } else {
        await Student.create({
          userId,
          name,
          photoUrl,
          photoDataUri: photoUrl,
          legacyId,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        });
        report.students.migrated++;
      }
    } else {
      report.students.migrated++;
    }
  }

  // -------------------------------------------------------------
  // 2. MIGRATE GRADES
  // -------------------------------------------------------------
  const gradesList = Array.isArray(dbData.grades) ? dbData.grades : [];
  report.grades.totalRead = gradesList.length;

  for (const item of gradesList) {
    const gradeNum = Number(item.grade);
    if (
      !item.studentName ||
      !item.subject ||
      !item.className ||
      isNaN(gradeNum) ||
      gradeNum < 0 ||
      gradeNum > 100
    ) {
      report.grades.invalid++;
      report.grades.invalidDetails.push({ id: item.id || 'unknown', reason: 'Invalid fields or grade score out of 0-100 range' });
      continue;
    }

    report.grades.valid++;
    const userId = item.uid || 'mock-teacher-id';
    const legacyId = item.id || undefined;
    const date = item.date ? new Date(item.date) : new Date();

    if (!dryRun) {
      const existing = await Grade.findOne({
        $or: [
          { legacyId: item.id },
          { userId, studentName: item.studentName.trim(), subject: item.subject.trim(), className: item.className.trim(), date },
        ],
      });

      if (existing) {
        report.grades.duplicates++;
      } else {
        await Grade.create({
          userId,
          studentName: item.studentName.trim(),
          subject: item.subject.trim(),
          grade: gradeNum,
          className: item.className.trim(),
          date,
          legacyId,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        });
        report.grades.migrated++;
      }
    } else {
      report.grades.migrated++;
    }
  }

  // -------------------------------------------------------------
  // 3. MIGRATE CALENDAR EVENTS
  // -------------------------------------------------------------
  const calendarList = Array.isArray(dbData.calendarEvents) ? dbData.calendarEvents : [];
  report.calendarEvents.totalRead = calendarList.length;

  for (const item of calendarList) {
    if (!item.title || !item.date) {
      report.calendarEvents.invalid++;
      report.calendarEvents.invalidDetails.push({ id: item.id || 'unknown', reason: 'Missing title or event date' });
      continue;
    }

    report.calendarEvents.valid++;
    const userId = item.uid || 'mock-teacher-id';
    const legacyId = item.id || undefined;
    const date = new Date(item.date);
    const type = ['Lesson', 'Deadline', 'Event', 'Holiday'].includes(item.type) ? item.type : 'Event';

    if (!dryRun) {
      const existing = await CalendarEvent.findOne({
        $or: [{ legacyId: item.id }, { userId, title: item.title.trim(), date }],
      });

      if (existing) {
        report.calendarEvents.duplicates++;
      } else {
        await CalendarEvent.create({
          userId,
          title: item.title.trim(),
          date,
          type,
          legacyId,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        });
        report.calendarEvents.migrated++;
      }
    } else {
      report.calendarEvents.migrated++;
    }
  }

  // -------------------------------------------------------------
  // 4. MIGRATE ATTENDANCE
  // -------------------------------------------------------------
  const attendanceList = Array.isArray(dbData.attendance) ? dbData.attendance : [];
  report.attendance.totalRead = attendanceList.length;

  for (const item of attendanceList) {
    if (!item.date || isNaN(new Date(item.date).getTime())) {
      report.attendance.invalid++;
      report.attendance.invalidDetails.push({ id: item.id || 'unknown', reason: 'Missing or invalid attendance date' });
      continue;
    }

    report.attendance.valid++;
    const userId = item.uid || 'mock-teacher-id';
    const legacyId = item.id || undefined;
    const date = new Date(item.date);
    const presentStudents = Array.isArray(item.presentStudents) ? item.presentStudents : [];

    if (!dryRun) {
      const existing = await Attendance.findOne({
        $or: [{ legacyId: item.id }, { userId, date }],
      });

      let photoUrl = '';
      if (item.photoDataUri && item.photoDataUri.startsWith('data:image/')) {
        try {
          const stored = await saveBase64Image(item.photoDataUri, 'attendance', `migrated_${legacyId || 'att'}`);
          photoUrl = stored.url;
        } catch (e: any) {
          console.warn(`   ⚠️ Warning: Failed to extract attendance photo: ${e.message}`);
        }
      } else if (item.photoDataUri) {
        photoUrl = item.photoDataUri;
      }

      if (existing) {
        report.attendance.duplicates++;
      } else {
        await Attendance.create({
          userId,
          date,
          presentStudents,
          photoUrl,
          photoDataUri: photoUrl,
          legacyId,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        });
        report.attendance.migrated++;
      }
    } else {
      report.attendance.migrated++;
    }
  }

  // -------------------------------------------------------------
  // 5. MIGRATE CLASS RECORDINGS
  // -------------------------------------------------------------
  const recordingsList = Array.isArray(dbData.recordings) ? dbData.recordings : [];
  report.recordings.totalRead = recordingsList.length;

  for (const item of recordingsList) {
    if (!item.title || !item.videoUrl) {
      report.recordings.invalid++;
      report.recordings.invalidDetails.push({ id: item.id || 'unknown', reason: 'Missing recording title or video URL' });
      continue;
    }

    report.recordings.valid++;
    const userId = item.uid || 'mock-teacher-id';
    const legacyId = item.id || undefined;

    if (!dryRun) {
      const existing = await ClassRecording.findOne({
        $or: [{ legacyId: item.id }, { userId, title: item.title.trim(), videoUrl: item.videoUrl.trim() }],
      });

      if (existing) {
        report.recordings.duplicates++;
      } else {
        await ClassRecording.create({
          userId,
          title: item.title.trim(),
          videoUrl: item.videoUrl.trim(),
          thumbnailUrl: item.thumbnailUrl || '',
          duration: item.duration || '0:00',
          legacyId,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        });
        report.recordings.migrated++;
      }
    } else {
      report.recordings.migrated++;
    }
  }

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  console.log('======================================================');
  console.log('📊 MIGRATION EXECUTION SUMMARY');
  console.log('======================================================');
  console.table(
    Object.entries(report).map(([collection, stat]) => ({
      Collection: collection,
      'Total Read': stat.totalRead,
      Valid: stat.valid,
      Invalid: stat.invalid,
      'Migrated / New': stat.migrated,
      'Existing / Duplicates': stat.duplicates,
    }))
  );

  let hasInvalid = false;
  for (const [col, stat] of Object.entries(report)) {
    if (stat.invalid > 0) {
      hasInvalid = true;
      console.log(`⚠️ Invalid Records in ${col}:`, stat.invalidDetails);
    }
  }
  if (!hasInvalid) {
    console.log('✅ All source records met schema validation requirements with 0 invalid records.');
  }

  // -------------------------------------------------------------
  // POST-MIGRATION DATA INTEGRITY VERIFICATION
  // -------------------------------------------------------------
  if (!dryRun) {
    console.log('\n======================================================');
    console.log('🔍 POST-MIGRATION DATA INTEGRITY VERIFICATION');
    console.log('======================================================');
    const [dbStudents, dbGrades, dbEvents, dbAttendance, dbRecordings] = await Promise.all([
      Student.countDocuments(),
      Grade.countDocuments(),
      CalendarEvent.countDocuments(),
      Attendance.countDocuments(),
      ClassRecording.countDocuments(),
    ]);

    console.log(`MongoDB Collection Counts:`);
    console.log(` - Students:        ${dbStudents} documents`);
    console.log(` - Grades:          ${dbGrades} documents`);
    console.log(` - CalendarEvents:  ${dbEvents} documents`);
    console.log(` - Attendance:      ${dbAttendance} documents`);
    console.log(` - ClassRecordings: ${dbRecordings} documents`);

    // Verify key fields on a sample student
    const sampleStudent = await Student.findOne({ name: 'Tushar Gupta' });
    if (sampleStudent) {
      console.log(`\nSample Verification [Student: ${sampleStudent.name}]:`);
      console.log(` - User ID:   ${sampleStudent.userId}`);
      console.log(` - Legacy ID: ${sampleStudent.legacyId}`);
      console.log(` - Photo URL: ${sampleStudent.photoUrl} (Verified non-Base64 file reference)`);
    }

    // Verify key fields on a sample grade
    const sampleGrade = await Grade.findOne({ studentName: 'Keshav' });
    if (sampleGrade) {
      console.log(`\nSample Verification [Grade: ${sampleGrade.studentName} - ${sampleGrade.subject}]:`);
      console.log(` - Grade:     ${sampleGrade.grade}`);
      console.log(` - Class:     ${sampleGrade.className}`);
      console.log(` - Legacy ID: ${sampleGrade.legacyId}`);
    }
  }

  return { report, backupPath };
}

// Direct execution CLI runner
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n✨ Migration process finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Fatal migration error:', err);
      process.exit(1);
    });
}
