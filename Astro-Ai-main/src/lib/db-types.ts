export type Student = {
  id: string;
  uid: string;
  name: string;
  photoDataUri: string;
};

export type GradeEntry = {
    id: string;
    uid: string;
    studentName: string;
    subject: string;
    grade: number;
    className: string;
    date: Date;
};

export type CalendarEvent = {
    id: string;
    uid: string;
    title: string;
    date: Date;
    type: 'Lesson' | 'Deadline' | 'Event' | 'Holiday';
};

export type ClassRecording = {
    id: string;
    uid: string;
    title: string;
    videoUrl: string;
    thumbnailUrl: string;
    duration: string;
    createdAt: Date;
};
