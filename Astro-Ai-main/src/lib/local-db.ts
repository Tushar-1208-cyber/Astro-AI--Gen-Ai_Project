import fs from 'fs';
import path from 'path';

// Move DB outside of project folder to prevent Next.js from rebuilding on every write
const DB_PATH = path.join(process.cwd(), '..', 'astro_ai_local_db.json');

// Server-only execution check
if (typeof window === 'undefined') {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({
            students: [],
            grades: [],
            calendarEvents: [],
            attendance: [],
            recordings: []
        }, null, 2));
    }
}

export const localDb = {
    read: () => {
        try {
            const data = fs.readFileSync(DB_PATH, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            return { students: [], grades: [], calendarEvents: [], attendance: [], recordings: [] };
        }
    },
    write: (data: any) => {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    },
    
    // Generic methods
    getData: (collection: string, uid: string) => {
        const db = localDb.read();
        return (db[collection] || []).filter((item: any) => item.uid === uid || item.uid === 'mock-teacher-id');
    },
    
    addData: (collection: string, uid: string, item: any) => {
        const db = localDb.read();
        if (!db[collection]) db[collection] = [];
        const newItem = { ...item, id: Math.random().toString(36).substr(2, 9), uid, createdAt: new Date() };
        db[collection].push(newItem);
        localDb.write(db);
        return newItem;
    },
    
    deleteData: (collection: string, uid: string, id: string) => {
        const db = localDb.read();
        if (!db[collection]) return;
        db[collection] = db[collection].filter((item: any) => item.id !== id);
        localDb.write(db);
    }
};
