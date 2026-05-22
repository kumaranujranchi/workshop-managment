import { DatabaseSync } from 'node:sqlite';
import path from 'path';

// Store the database file in the root of the project
const dbPath = path.resolve(process.cwd(), 'workshop.db');
const rawDb = new DatabaseSync(dbPath);

// Set busy timeout and WAL mode to handle concurrent writes during build compilation
rawDb.exec('PRAGMA busy_timeout = 5000;');
rawDb.exec('PRAGMA journal_mode = WAL;');

// Check and migrate agent_audit_logs check constraint to support 'failed'
try {
  rawDb.exec("INSERT INTO agent_audit_logs (id, targetType, targetId, observation, reasoning, recommendedAction, status) VALUES ('temp_mig_test', 'test', 'test', 'test', 'test', 'test', 'failed')");
  rawDb.exec("DELETE FROM agent_audit_logs WHERE id = 'temp_mig_test'");
} catch (err) {
  if (err.message && err.message.includes('CHECK constraint failed')) {
    console.log('[Database] Recreating agent_audit_logs table to support failed status...');
    rawDb.exec('DROP TABLE IF EXISTS agent_audit_logs');
  }
}

// Run workshop table alterations
try {
  rawDb.exec("ALTER TABLE workshops ADD COLUMN dateTime TEXT;");
} catch (err) {
  // Ignored if column already exists
}
try {
  rawDb.exec("ALTER TABLE workshops ADD COLUMN capacity INTEGER DEFAULT 20;");
} catch (err) {
  // Ignored if column already exists
}

// Run participant table alterations
try {
  rawDb.exec("ALTER TABLE participants ADD COLUMN expectations TEXT;");
} catch (err) {
  // Ignored if column already exists
}

// Recreate participants to support 'waitlisted' check constraint
let needsParticipantsRecreate = false;
try {
  rawDb.exec("INSERT INTO participants (id, name, email, workshopId, status, onboardingStatus) VALUES ('temp_waitlist_mig', 'test', 'test', 'non_existent_ws', 'waitlisted', 'pending')");
  rawDb.exec("DELETE FROM participants WHERE id = 'temp_waitlist_mig'");
} catch (err) {
  if (err.message && err.message.includes('CHECK constraint failed')) {
    needsParticipantsRecreate = true;
  }
}

if (needsParticipantsRecreate) {
  console.log('[Database] Recreating participants table to support waitlisted status...');
  try {
    rawDb.exec("ALTER TABLE participants RENAME TO participants_old;");
  } catch (err) {
    console.error('Failed to rename participants table:', err);
  }
}

// Initialize database schema
rawDb.exec(`
  CREATE TABLE IF NOT EXISTS facilitators (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS workshops (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    facilitatorId TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('draft', 'published', 'registration_closed', 'completed', 'archived')),
    dateTime TEXT,
    capacity INTEGER DEFAULT 20,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(facilitatorId) REFERENCES facilitators(id)
  );

  CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    workshopId TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('registered', 'confirmed', 'declined', 'waitlisted')),
    onboardingStatus TEXT NOT NULL CHECK(onboardingStatus IN ('pending', 'completed')),
    expectations TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(workshopId) REFERENCES workshops(id)
  );

  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    workshopId TEXT NOT NULL,
    participantId TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comments TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(workshopId) REFERENCES workshops(id),
    FOREIGN KEY(participantId) REFERENCES participants(id)
  );

  CREATE TABLE IF NOT EXISTS agent_audit_logs (
    id TEXT PRIMARY KEY,
    targetType TEXT NOT NULL,
    targetId TEXT NOT NULL,
    observation TEXT NOT NULL,
    reasoning TEXT NOT NULL,
    recommendedAction TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('proposed', 'approved', 'dismissed', 'executed', 'failed')),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('email', 'calendar')),
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('sent', 'revoked', 'failed')),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

if (needsParticipantsRecreate) {
  try {
    rawDb.exec(`
      INSERT INTO participants (id, name, email, workshopId, status, onboardingStatus, expectations, createdAt)
      SELECT id, name, email, workshopId, status, onboardingStatus, expectations, createdAt
      FROM participants_old;
    `);
    rawDb.exec("DROP TABLE participants_old;");
    console.log('[Database] Participants table successfully migrated.');
  } catch (err) {
    console.error('Failed to migrate participants data:', err);
  }
}

// Wrapper helper to mimic better-sqlite3 API
const db = {
  exec: (sql) => rawDb.exec(sql),
  prepare: (sql) => {
    const stmt = rawDb.prepare(sql);
    return {
      all: (...args) => stmt.all(...args),
      get: (...args) => {
        const rows = stmt.all(...args);
        return rows[0];
      },
      run: (...args) => {
        const result = stmt.run(...args);
        return result;
      }
    };
  }
};

// Seed default facilitators if empty
const seedFacilitators = db.prepare('SELECT COUNT(*) as count FROM facilitators').get();
if (seedFacilitators.count === 0) {
  const insert = db.prepare('INSERT INTO facilitators (id, name, email) VALUES (?, ?, ?)');
  insert.run('f1', 'Amit Sharma', 'amit.sharma@example.com');
  insert.run('f2', 'Priya Patel', 'priya.patel@example.com');
  insert.run('f3', 'Dr. Rajesh Kumar', 'rajesh.kumar@example.com');
  console.log('Seeded default facilitators.');
}

export default db;
