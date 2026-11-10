import { studentRepo, gradeRepo, calendarRepo, recordingRepo, attendanceRepo } from './db-repo';
import type { Student, GradeEntry, CalendarEvent, ClassRecording } from './db-types';

export type { Student, GradeEntry, CalendarEvent, ClassRecording };

/**
 * Modernized persistence layer - backed by MongoDB models.
 * Completely eliminates old JSON database file operations while preserving backward-compatible interfaces.
 */

export const studentRosterDb = {
  getStudents: async (uid: string): Promise<Student[]> => {
    const docs = await studentRepo.getStudents(uid);
    return docs.map((d: any) => ({
      id: d.id || d._id.toString(),
      uid: d.userId,
      name: d.name,
      photoDataUri: d.photoDataUri || d.photoUrl || '',
    }));
  },
  addStudent: async (uid: string, student: Omit<Student, 'id' | 'uid'>): Promise<void> => {
    await studentRepo.addStudent(uid, student);
  },
  deleteStudent: async (uid: string, id: string): Promise<void> => {
    await studentRepo.deleteStudent(uid, id);
  },
};

export const gradesDb = {
  getGrades: async (uid: string): Promise<GradeEntry[]> => {
    const docs = await gradeRepo.getGrades(uid);
    return docs.map((d: any) => ({
      id: d.id || d._id.toString(),
      uid: d.userId,
      studentName: d.studentName,
      subject: d.subject,
      grade: d.grade,
      className: d.className,
      date: d.date,
    }));
  },
  addGrade: async (uid: string, grade: Omit<GradeEntry, 'id' | 'uid'>): Promise<void> => {
    await gradeRepo.addGrade(uid, grade);
  },
  deleteGrade: async (uid: string, id: string): Promise<void> => {
    await gradeRepo.deleteGrade(uid, id);
  },
};

export const calendarDb = {
  getEvents: async (uid: string): Promise<CalendarEvent[]> => {
    const docs = await calendarRepo.getEvents(uid);
    return docs.map((d: any) => ({
      id: d.id || d._id.toString(),
      uid: d.userId,
      title: d.title,
      date: d.date,
      type: d.type,
    }));
  },
  addEvent: async (uid: string, event: Omit<CalendarEvent, 'id' | 'uid'>): Promise<void> => {
    await calendarRepo.addEvent(uid, event);
  },
  deleteEvent: async (uid: string, id: string): Promise<void> => {
    await calendarRepo.deleteEvent(uid, id);
  },
};

export const recordingsDb = {
  getRecordings: async (uid: string): Promise<ClassRecording[]> => {
    const docs = await recordingRepo.getRecordings(uid);
    return docs.map((d: any) => ({
      id: d.id || d._id.toString(),
      uid: d.userId,
      title: d.title,
      videoUrl: d.videoUrl,
      thumbnailUrl: d.thumbnailUrl || '',
      duration: d.duration || '0:00',
      createdAt: d.createdAt,
    }));
  },
  addRecording: async (uid: string, recording: Omit<ClassRecording, 'id' | 'uid' | 'createdAt'>): Promise<void> => {
    await recordingRepo.addRecording(uid, {
      title: recording.title,
      videoUrl: recording.videoUrl,
      thumbnailUrl: recording.thumbnailUrl || '',
      duration: recording.duration || '0:00',
    });
  },
  deleteRecording: async (uid: string, id: string): Promise<void> => {
    await recordingRepo.deleteRecording(uid, id);
  },
};

export const attendanceDb = {
  getAttendance: async (uid: string): Promise<any[]> => {
    const docs = await attendanceRepo.getAttendance(uid);
    return docs.map((d: any) => ({
      id: d.id || d._id.toString(),
      uid: d.userId,
      date: d.date,
      presentStudents: d.presentStudents,
      photoDataUri: d.photoDataUri || d.photoUrl || '',
    }));
  },
  addAttendance: async (
    uid: string,
    record: { date: Date; presentStudents: string[]; photoDataUri: string }
  ): Promise<void> => {
    await attendanceRepo.addAttendance(uid, record);
  },
  deleteAttendance: async (uid: string, id: string): Promise<void> => {
    await attendanceRepo.deleteAttendance(uid, id);
  },
};
