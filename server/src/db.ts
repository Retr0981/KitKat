/**
 * SQLite layer for the KitKat analytics server.
 *
 * Schema is intentionally tiny + heavily indexed to meet the success criterion
 * (10,000 events queried in <1s). WAL mode + prepared statements keep both
 * inserts and aggregations fast.
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.KITKAT_DB ?? join(__dirname, '..', 'kitkat.db');

export interface EventRow {
  id: number;
  type: string;
  origin: string;
  tool_name: string | null;
  status: string | null;
  duration_ms: number | null;
  tab_id: number | null;
  at: number;
}

let _db: Database.Database | null = null;

/** Open (or reuse) the database connection + initialize schema. */
export function db(): Database.Database {
  if (_db) return _db;
  const d = new Database(DB_PATH);
  d.pragma('journal_mode = WAL');
  d.pragma('synchronous = NORMAL');
  d.pragma('foreign_keys = ON');

  d.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      origin TEXT NOT NULL,
      tool_name TEXT,
      status TEXT,
      duration_ms INTEGER,
      tab_id INTEGER,
      at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_at ON events(at);
    CREATE INDEX IF NOT EXISTS idx_events_tool ON events(tool_name);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
  `);

  _db = d;
  return d;
}

/** Close the DB (tests). */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export { DB_PATH };
