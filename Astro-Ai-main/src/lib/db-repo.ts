import dbConnect from './db';
import Student, { IStudent } from '@/models/Student';
import Grade, { IGrade } from '@/models/Grade';
import CalendarEvent, { ICalendarEvent } from '@/models/CalendarEvent';
import ClassRecording, { IClassRecording } from '@/models/ClassRecording';
import Attendance, { IAttendance } from '@/models/Attendance';
import { saveBase64Image, deleteStoredImage } from './storage';

/**
 * MongoDB-backed unified repository layer.
 * All operations strictly enforce authenticated user ownership (userId).
 * Supports search, filtering, sorting, and pagination.
 */

// ==========================================
// 1. STUDENT REPOSITORY
// ==========================================
export const studentRepo = {
  getStudents: async (
    userId: string,
    options: { search?: string; page?: number; limit?: number; sort?: string } = {}
  ): Promise<IStudent[]> => {
    await dbConnect();
    const query: any = { userId };

    if (options.search && options.search.trim()) {
      query.name = { $regex: options.search.trim(), $options: 'i' };
    }

    const sortOrder: any = options.sort === 'name' ? { name: 1 } : { createdAt: -1 };
    const page = Math.max(1, options.page || 1);
    const limit = options.limit ? Math.min(100, options.limit) : 0; // 0 = no limit

    let q = Student.find(query).sort(sortOrder);
    if (limit > 0) {
      q = q.skip((page - 1) * limit).limit(limit);
    }
    return await q.exec();
  },

  getStudentById: async (userId: string, id: string): Promise<IStudent | null> => {
    await dbConnect();
    // Query by either MongoDB _id or legacyId
    return await Student.findOne({
      userId,
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { legacyId: id }],
    }).exec();
  },

  addStudent: async (
    userId: string,
    data: { name: string; photoDataUri?: string; photoUrl?: string }
  ): Promise<IStudent> => {
    await dbConnect();

    let finalPhotoUrl = data.photoUrl || '';
    if (data.photoDataUri && data.photoDataUri.startsWith('data:image/')) {
      try {
        const stored = await saveBase64Image(data.photoDataUri, 'students', data.name);
        finalPhotoUrl = stored.url;
      } catch (err) {
        console.warn('[StudentRepo] Could not store image file, continuing without file storage:', err);
      }
    } else if (data.photoDataUri) {
      finalPhotoUrl = data.photoDataUri;
    }

    const newStudent = await Student.create({
      userId,
      name: data.name.trim(),
      photoUrl: finalPhotoUrl,
      photoDataUri: finalPhotoUrl,
    });
    return newStudent;
  },

  updateStudent: async (
    userId: string,
    id: string,
    data: { name?: string; photoDataUri?: string; photoUrl?: string }
  ): Promise<IStudent | null> => {
    await dbConnect();

    const student = await studentRepo.getStudentById(userId, id);
    if (!student) return null;

    if (data.name !== undefined) student.name = data.name.trim();

    if (data.photoDataUri && data.photoDataUri.startsWith('data:image/')) {
      try {
        // Delete old file if existed
        if (student.photoUrl) {
          await deleteStoredImage(student.photoUrl, 'students');
        }
        const stored = await saveBase64Image(data.photoDataUri, 'students', student.name);
        student.photoUrl = stored.url;
        student.photoDataUri = stored.url;
      } catch (err) {
        console.warn('[StudentRepo] Error updating image file:', err);
      }
    } else if (data.photoUrl !== undefined) {
      student.photoUrl = data.photoUrl;
      student.photoDataUri = data.photoUrl;
    }

    await student.save();
    return student;
  },

  deleteStudent: async (userId: string, id: string): Promise<boolean> => {
    await dbConnect();
    const student = await studentRepo.getStudentById(userId, id);
    if (!student) return false;

    // Clean up stored image file if exists
    if (student.photoUrl) {
      await deleteStoredImage(student.photoUrl, 'students');
    }

    const result = await Student.deleteOne({ _id: student._id, userId });
    return result.deletedCount === 1;
  },
};

// ==========================================
// 2. GRADE REPOSITORY
// ==========================================
export const gradeRepo = {
  getGrades: async (
    userId: string,
    options: { className?: string; subject?: string; search?: string; page?: number; limit?: number; sort?: string } = {}
  ): Promise<IGrade[]> => {
    await dbConnect();
    const query: any = { userId };

    if (options.className && options.className.trim()) {
      query.className = options.className.trim();
    }
    if (options.subject && options.subject.trim()) {
      query.subject = options.subject.trim();
    }
    if (options.search && options.search.trim()) {
      query.studentName = { $regex: options.search.trim(), $options: 'i' };
    }

    const sortOrder: any = options.sort === 'grade' ? { grade: -1 } : { date: -1 };
    const page = Math.max(1, options.page || 1);
    const limit = options.limit ? Math.min(100, options.limit) : 0;

    let q = Grade.find(query).sort(sortOrder);
    if (limit > 0) {
      q = q.skip((page - 1) * limit).limit(limit);
    }
    return await q.exec();
  },

  getGradeById: async (userId: string, id: string): Promise<IGrade | null> => {
    await dbConnect();
    return await Grade.findOne({
      userId,
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { legacyId: id }],
    }).exec();
  },

  addGrade: async (
    userId: string,
    data: { studentName: string; subject: string; grade: number; className: string; date?: Date | string }
  ): Promise<IGrade> => {
    await dbConnect();
    const newGrade = await Grade.create({
      userId,
      studentName: data.studentName.trim(),
      subject: data.subject.trim(),
      grade: Number(data.grade),
      className: data.className.trim(),
      date: data.date ? new Date(data.date) : new Date(),
    });
    return newGrade;
  },

  updateGrade: async (
    userId: string,
    id: string,
    data: Partial<{ studentName: string; subject: string; grade: number; className: string; date: Date | string }>
  ): Promise<IGrade | null> => {
    await dbConnect();
    const grade = await gradeRepo.getGradeById(userId, id);
    if (!grade) return null;

    if (data.studentName !== undefined) grade.studentName = data.studentName.trim();
    if (data.subject !== undefined) grade.subject = data.subject.trim();
    if (data.grade !== undefined) grade.grade = Number(data.grade);
    if (data.className !== undefined) grade.className = data.className.trim();
    if (data.date !== undefined) grade.date = new Date(data.date);

    await grade.save();
    return grade;
  },

  deleteGrade: async (userId: string, id: string): Promise<boolean> => {
    await dbConnect();
    const grade = await gradeRepo.getGradeById(userId, id);
    if (!grade) return false;

    const result = await Grade.deleteOne({ _id: grade._id, userId });
    return result.deletedCount === 1;
  },
};

// ==========================================
// 3. CALENDAR EVENT REPOSITORY
// ==========================================
export const calendarRepo = {
  getEvents: async (
    userId: string,
    options: { type?: string; startDate?: Date; endDate?: Date; page?: number; limit?: number } = {}
  ): Promise<ICalendarEvent[]> => {
    await dbConnect();
    const query: any = { userId };

    if (options.type && options.type.trim()) {
      query.type = options.type.trim();
    }
    if (options.startDate || options.endDate) {
      query.date = {};
      if (options.startDate) query.date.$gte = options.startDate;
      if (options.endDate) query.date.$lte = options.endDate;
    }

    const page = Math.max(1, options.page || 1);
    const limit = options.limit ? Math.min(100, options.limit) : 0;

    let q = CalendarEvent.find(query).sort({ date: 1 });
    if (limit > 0) {
      q = q.skip((page - 1) * limit).limit(limit);
    }
    return await q.exec();
  },

  getEventById: async (userId: string, id: string): Promise<ICalendarEvent | null> => {
    await dbConnect();
    return await CalendarEvent.findOne({
      userId,
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { legacyId: id }],
    }).exec();
  },

  addEvent: async (
    userId: string,
    data: { title: string; date: Date | string; type?: 'Lesson' | 'Deadline' | 'Event' | 'Holiday'; description?: string }
  ): Promise<ICalendarEvent> => {
    await dbConnect();
    const newEvent = await CalendarEvent.create({
      userId,
      title: data.title.trim(),
      date: new Date(data.date),
      type: data.type || 'Event',
      description: data.description || '',
    });
    return newEvent;
  },

  deleteEvent: async (userId: string, id: string): Promise<boolean> => {
    await dbConnect();
    const event = await calendarRepo.getEventById(userId, id);
    if (!event) return false;

    const result = await CalendarEvent.deleteOne({ _id: event._id, userId });
    return result.deletedCount === 1;
  },
};

// ==========================================
// 4. CLASS RECORDINGS REPOSITORY
// ==========================================
export const recordingRepo = {
  getRecordings: async (
    userId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<IClassRecording[]> => {
    await dbConnect();
    const query = { userId };
    const page = Math.max(1, options.page || 1);
    const limit = options.limit ? Math.min(100, options.limit) : 0;

    let q = ClassRecording.find(query).sort({ createdAt: -1 });
    if (limit > 0) {
      q = q.skip((page - 1) * limit).limit(limit);
    }
    return await q.exec();
  },

  getRecordingById: async (userId: string, id: string): Promise<IClassRecording | null> => {
    await dbConnect();
    return await ClassRecording.findOne({
      userId,
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { legacyId: id }],
    }).exec();
  },

  addRecording: async (
    userId: string,
    data: { title: string; videoUrl: string; thumbnailUrl?: string; duration?: string }
  ): Promise<IClassRecording> => {
    await dbConnect();
    const newRecording = await ClassRecording.create({
      userId,
      title: data.title.trim(),
      videoUrl: data.videoUrl.trim(),
      thumbnailUrl: data.thumbnailUrl || '',
      duration: data.duration || '0:00',
    });
    return newRecording;
  },

  deleteRecording: async (userId: string, id: string): Promise<boolean> => {
    await dbConnect();
    const rec = await recordingRepo.getRecordingById(userId, id);
    if (!rec) return false;

    const result = await ClassRecording.deleteOne({ _id: rec._id, userId });
    return result.deletedCount === 1;
  },
};

// ==========================================
// 5. ATTENDANCE REPOSITORY
// ==========================================
export const attendanceRepo = {
  getAttendance: async (
    userId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<IAttendance[]> => {
    await dbConnect();
    const query = { userId };
    const page = Math.max(1, options.page || 1);
    const limit = options.limit ? Math.min(100, options.limit) : 0;

    let q = Attendance.find(query).sort({ date: -1 });
    if (limit > 0) {
      q = q.skip((page - 1) * limit).limit(limit);
    }
    return await q.exec();
  },

  addAttendance: async (
    userId: string,
    data: {
      date: Date | string;
      presentStudents: string[];
      photoDataUri?: string;
      photoUrl?: string;
      totalStudents?: number;
    }
  ): Promise<IAttendance> => {
    await dbConnect();

    let finalPhotoUrl = data.photoUrl || '';
    if (data.photoDataUri && data.photoDataUri.startsWith('data:image/')) {
      try {
        const stored = await saveBase64Image(data.photoDataUri, 'attendance', 'attendance');
        finalPhotoUrl = stored.url;
      } catch (err) {
        console.warn('[AttendanceRepo] Could not store photo file:', err);
      }
    } else if (data.photoDataUri) {
      finalPhotoUrl = data.photoDataUri;
    }

    // Capture historical roster size snapshot at session creation time
    let totalStudents = data.totalStudents;
    if (totalStudents === undefined) {
      totalStudents = await Student.countDocuments({ userId }).exec();
    }

    const newAttendance = await Attendance.create({
      userId,
      date: new Date(data.date),
      presentStudents: data.presentStudents || [],
      totalStudents,
      photoUrl: finalPhotoUrl,
      photoDataUri: finalPhotoUrl,
    });
    return newAttendance;
  },

  deleteAttendance: async (userId: string, id: string): Promise<boolean> => {
    await dbConnect();
    const record = await Attendance.findOne({
      userId,
      $or: [{ _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }, { legacyId: id }],
    }).exec();
    if (!record) return false;

    if (record.photoUrl) {
      await deleteStoredImage(record.photoUrl, 'attendance');
    }

    const result = await Attendance.deleteOne({ _id: record._id, userId });
    return result.deletedCount === 1;
  },
};

// ==========================================
// 6. DASHBOARD REPOSITORY
// ==========================================
export interface DashboardActivityRecord {
  id: string;
  type: 'grade' | 'event' | 'recording' | 'attendance';
  title: string;
  date: Date;
  metadata?: Record<string, any>;
}

export interface DashboardMetrics {
  totalStudents: number;
  totalGrades: number;
  averageGrade: number | null;
  hasGrades: boolean;
  upcomingEvents: number;
  totalRecordings: number;
  lessonsThisMonth: number;
  attendanceRate: number | null;
  totalAttendanceSessions: number;
  hasAttendance: boolean;
  recentActivity: DashboardActivityRecord[];
}

export const dashboardRepo = {
  getDashboardMetrics: async (userId: string): Promise<DashboardMetrics> => {
    await dbConnect();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // 1. Parallel collection queries with projections and aggregations
    const [
      totalStudents,
      gradeAggregation,
      recentGrades,
      upcomingEventsCount,
      lessonsThisMonthCount,
      recentEvents,
      recordingsCount,
      recentRecordings,
      attendanceSummary,
      recentAttendance,
    ] = await Promise.all([
      // Total active students count (fast index count; zero unbounded document serialization)
      Student.countDocuments({ userId }).exec(),

      // Grade statistics aggregation
      Grade.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            avgGrade: { $avg: '$grade' },
          },
        },
      ]).exec(),

      // Bounded recent grades
      Grade.find({ userId })
        .sort({ date: -1, _id: -1 })
        .limit(6)
        .select('_id studentName subject grade date')
        .lean()
        .exec(),

      // Upcoming calendar events (date >= now)
      CalendarEvent.countDocuments({ userId, date: { $gte: now } }).exec(),

      // Lessons this month (strictly calendar events of canonical type 'Lesson')
      CalendarEvent.countDocuments({
        userId,
        type: { $in: ['Lesson', 'lesson'] },
        date: { $gte: startOfMonth, $lte: endOfMonth },
      }).exec(),

      // Bounded recent calendar events
      CalendarEvent.find({ userId })
        .sort({ date: -1, _id: -1 })
        .limit(6)
        .select('_id title type date')
        .lean()
        .exec(),

      // Total recordings count
      ClassRecording.countDocuments({ userId }).exec(),

      // Bounded recent recordings
      ClassRecording.find({ userId })
        .sort({ createdAt: -1, _id: -1 })
        .limit(6)
        .select('_id title createdAt')
        .lean()
        .exec(),

      // Scalable Attendance aggregation: computes session count, verified denominators, and unique attendance directly in MongoDB
      Attendance.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            sessionsWithDenominator: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: [{ $type: '$totalStudents' }, 'missing'] },
                      { $ne: ['$totalStudents', null] },
                      { $gt: ['$totalStudents', 0] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            sumDenominator: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: [{ $type: '$totalStudents' }, 'missing'] },
                      { $ne: ['$totalStudents', null] },
                      { $gt: ['$totalStudents', 0] },
                    ],
                  },
                  '$totalStudents',
                  0,
                ],
              },
            },
            sumPresent: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: [{ $type: '$totalStudents' }, 'missing'] },
                      { $ne: ['$totalStudents', null] },
                      { $gt: ['$totalStudents', 0] },
                    ],
                  },
                  {
                    $min: [
                      { $size: { $setUnion: [{ $ifNull: ['$presentStudents', []] }, []] } },
                      '$totalStudents',
                    ],
                  },
                  0,
                ],
              },
            },
          },
        },
      ]).exec(),

      // Bounded recent attendance (strictly limited to 6 records)
      Attendance.find({ userId })
        .sort({ date: -1, _id: -1 })
        .limit(6)
        .select('_id date presentStudents')
        .lean()
        .exec(),
    ]);

    // 2. Grade summary calculations
    const totalGrades = gradeAggregation.length > 0 ? gradeAggregation[0].count : 0;
    const avgGradeRaw = gradeAggregation.length > 0 ? gradeAggregation[0].avgGrade : null;
    const hasGrades = totalGrades > 0 && avgGradeRaw !== null && !isNaN(avgGradeRaw);
    const averageGrade = hasGrades ? Math.min(100, Math.max(0, Math.round(avgGradeRaw))) : null;

    // 3. Attendance rate calculation via scalable MongoDB aggregation
    const attData =
      attendanceSummary.length > 0
        ? attendanceSummary[0]
        : { totalSessions: 0, sessionsWithDenominator: 0, sumDenominator: 0, sumPresent: 0 };

    const totalAttendanceSessions = attData.totalSessions;
    const hasAttendance = totalAttendanceSessions > 0;
    let attendanceRate: number | null = null;

    // Denominator integrity rule:
    // Attendance rate can ONLY be computed if EVERY session has an established, persisted historical denominator.
    // If any session lacks reliable historical roster information (e.g. legacy session without snapshot,
    // or where absent/present students could have been deleted without trace), return attendanceRate: null.
    const allSessionsHaveIntegrity =
      hasAttendance && attData.sessionsWithDenominator === totalAttendanceSessions;

    if (allSessionsHaveIntegrity && attData.sumDenominator > 0) {
      attendanceRate = Math.min(
        100,
        Math.max(0, Math.round((attData.sumPresent / attData.sumDenominator) * 100))
      );
    } else {
      attendanceRate = null;
    }

    // 4. Collate, format and sort recent activities
    const recentActivity: DashboardActivityRecord[] = [];

    for (const g of recentGrades) {
      recentActivity.push({
        id: (g._id || (g as any).id).toString(),
        type: 'grade',
        title: `Grade recorded for ${g.studentName} - ${g.subject} (${g.grade}%)`,
        date: g.date instanceof Date ? g.date : new Date(g.date),
        metadata: { studentName: g.studentName, subject: g.subject, grade: g.grade },
      });
    }

    for (const e of recentEvents) {
      recentActivity.push({
        id: (e._id || (e as any).id).toString(),
        type: 'event',
        title: `${e.type}: ${e.title}`,
        date: e.date instanceof Date ? e.date : new Date(e.date),
        metadata: { eventType: e.type, title: e.title },
      });
    }

    for (const r of recentRecordings) {
      recentActivity.push({
        id: (r._id || (r as any).id).toString(),
        type: 'recording',
        title: `Recording: ${r.title || 'Class Session'}`,
        date: r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt),
        metadata: { title: r.title },
      });
    }

    for (const a of recentAttendance) {
      const rawPresent = Array.isArray(a.presentStudents) ? a.presentStudents : [];
      const presentCount = new Set(
        rawPresent
          .map((s: any) => (typeof s === 'string' ? s.trim() : ''))
          .filter((s: string) => s.length > 0)
      ).size;
      recentActivity.push({
        id: (a._id || (a as any).id).toString(),
        type: 'attendance',
        title: `Attendance session: ${presentCount} student(s) marked present`,
        date: a.date instanceof Date ? a.date : new Date(a.date),
        metadata: { presentCount },
      });
    }

    // Deterministic sort: newest first, tie-breaker on id
    recentActivity.sort((a, b) => {
      const timeDiff = b.date.getTime() - a.date.getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.id.localeCompare(a.id);
    });

    const boundedRecentActivity = recentActivity.slice(0, 6);

    return {
      totalStudents,
      totalGrades,
      averageGrade,
      hasGrades,
      upcomingEvents: upcomingEventsCount,
      totalRecordings: recordingsCount,
      lessonsThisMonth: lessonsThisMonthCount,
      attendanceRate,
      totalAttendanceSessions,
      hasAttendance,
      recentActivity: boundedRecentActivity,
    };
  },
};
