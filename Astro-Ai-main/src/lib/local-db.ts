import fs from 'fs';
import path from 'path';

// Local flat database path
const DB_PATH = path.join(process.cwd(), '..', 'astro_ai_local_db.json');

// Server-only initialization check
if (typeof window === 'undefined') {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify(
        {
          students: [],
          grades: [],
          calendarEvents: [],
          attendance: [],
          recordings: [],
        },
        null,
        2
      )
    );
  }
}

export const localDb = {
  read: () => {
    try {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(data);
    } catch {
      return { students: [], grades: [], calendarEvents: [], attendance: [], recordings: [] };
    }
  },

  write: (data: any) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  },

  /**
   * Reads data belonging strictly to the specified authenticated user.
   * Enforces complete tenant/user isolation (No mock-teacher-id fallback).
   */
  getData: (collection: string, uid: string) => {
    if (!uid) return [];
    const db = localDb.read();
    return (db[collection] || []).filter((item: any) => item.uid === uid);
  },

  /**
   * Adds an item stamped with the authenticated user ID and creation timestamp.
   */
  addData: (collection: string, uid: string, item: any) => {
    if (!uid) throw new Error('Cannot add record without authenticated user ID');
    const db = localDb.read();
    if (!db[collection]) db[collection] = [];
    const newItem = {
      ...item,
      id: Math.random().toString(36).substr(2, 9),
      uid,
      createdAt: new Date(),
    };
    db[collection].push(newItem);
    localDb.write(db);
    return newItem;
  },

  /**
   * Deletes an item with strict ownership verification.
   * Users can only delete their own records.
   */
  deleteData: (collection: string, uid: string, id: string) => {
    if (!uid || !id) return false;
    const db = localDb.read();
    if (!db[collection]) return false;

    const initialLength = db[collection].length;
    db[collection] = db[collection].filter((item: any) => !(item.id === id && item.uid === uid));
    const wasDeleted = db[collection].length < initialLength;

    if (wasDeleted) {
      localDb.write(db);
    }
    return wasDeleted;
  },
};
