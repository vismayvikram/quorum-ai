import fs from 'fs';
import path from 'path';

/**
 * A simple in-memory document store backed by a local JSON file to mock Firestore.
 */
const DB_FILE = path.join(process.cwd(), 'local-db.json');

type CollectionName = 'profiles' | 'tasks' | 'subtasks' | 'settings' | 'taxes' | 'users' | 'oauth_tokens';

interface DBState {
  profiles: Record<string, any>;
  tasks: Record<string, any>;
  subtasks: Record<string, any>;
  settings: Record<string, any>;
  taxes: Record<string, any>;
  users: Record<string, any>;
  oauth_tokens: Record<string, any>;
}

let db: DBState = {
  profiles: {},
  tasks: {},
  subtasks: {},
  settings: {},
  taxes: {},
  users: {},
  oauth_tokens: {},
};

// Load existing DB
if (fs.existsSync(DB_FILE)) {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    db = JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse local DB', e);
  }
}

function persist() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

export const store = {
  getCollection(name: CollectionName): any[] {
    return Object.values(db[name]).filter(doc => doc !== null && doc !== undefined);
  },

  getDoc(collection: CollectionName, id: string): any | null {
    return db[collection][id] || null;
  },

  setDoc(collection: CollectionName, id: string, data: any): void {
    if (data === undefined || data === null) {
      delete db[collection][id];
    } else {
      db[collection][id] = data;
    }
    persist();
  },

  updateDoc(collection: CollectionName, id: string, data: any): void {
    if (db[collection][id]) {
      db[collection][id] = { ...db[collection][id], ...data };
      persist();
    }
  },

  query(collection: CollectionName, filterFn: (doc: any) => boolean): any[] {
    return Object.values(db[collection])
      .filter(doc => doc !== null && doc !== undefined)
      .filter(filterFn);
  }
};
