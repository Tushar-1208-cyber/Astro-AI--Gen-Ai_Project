import { localDb } from './local-db';
import type { Student, GradeEntry, CalendarEvent, ClassRecording } from './db-types';

export type { Student, GradeEntry, CalendarEvent, ClassRecording };

// --- LOCAL DB LAYER ---
// We use local_db.json file on your laptop to store everything!

export const studentRosterDb = {
  getStudents: async (uid: string): Promise<Student[]> => {
    return localDb.getData('students', uid);
  },
  addStudent: async (uid: string, student: Omit<Student, 'id' | 'uid'>): Promise<void> => {
    localDb.addData('students', uid, student);
  },
  deleteStudent: async (uid: string, id: string): Promise<void> => {
    localDb.deleteData('students', uid, id);
  }
};

export const gradesDb = {
    getGrades: async (uid: string): Promise<GradeEntry[]> => {
        return localDb.getData('grades', uid);
    },
    addGrade: async (uid: string, grade: Omit<GradeEntry, 'id' | 'uid'>): Promise<void> => {
        localDb.addData('grades', uid, grade);
    },
    deleteGrade: async (uid: string, id: string): Promise<void> => {
        localDb.deleteData('grades', uid, id);
    }
}

export const calendarDb = {
    getEvents: async (uid: string): Promise<CalendarEvent[]> => {
        return localDb.getData('calendarEvents', uid);
    },
    addEvent: async (uid: string, event: Omit<CalendarEvent, 'id' | 'uid'>): Promise<void> => {
        localDb.addData('calendarEvents', uid, event);
    },
    deleteEvent: async (uid: string, id: string): Promise<void> => {
        localDb.deleteData('calendarEvents', uid, id);
    }
}

export const recordingsDb = {
    getRecordings: async (uid: string): Promise<ClassRecording[]> => {
        return localDb.getData('recordings', uid);
    },
    addRecording: async (uid: string, recording: Omit<ClassRecording, 'id' | 'uid' | 'createdAt'>): Promise<void> => {
        localDb.addData('recordings', uid, recording);
    },
    deleteRecording: async (uid: string, id: string): Promise<void> => {
        localDb.deleteData('recordings', uid, id);
    }
}

export const attendanceDb = {
    getAttendance: async (uid: string): Promise<any[]> => {
        return localDb.getData('attendance', uid);
    },
    addAttendance: async (uid: string, record: { date: Date, presentStudents: string[], photoDataUri: string }): Promise<void> => {
        localDb.addData('attendance', uid, record);
    }
}
