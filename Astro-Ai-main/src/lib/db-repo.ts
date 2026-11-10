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
    data: { date: Date | string; presentStudents: string[]; photoDataUri?: string; photoUrl?: string }
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

    const newAttendance = await Attendance.create({
      userId,
      date: new Date(data.date),
      presentStudents: data.presentStudents || [],
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
