import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { EventRecord } from "./types";
import { atMidnight } from "./utils/dateRange";

const DB_PATH = process.env.DB_PATH || "./data/events.db";

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    event_date TEXT,
    event_date_text TEXT,
    location TEXT,
    source_text TEXT,
    source_chat TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const existingColumns = new Set(
  (db.prepare(`PRAGMA table_info(events)`).all() as { name: string }[]).map((c) => c.name)
);
if (!existingColumns.has("description")) {
  db.exec(`ALTER TABLE events ADD COLUMN description TEXT`);
}
if (!existingColumns.has("source_url")) {
  db.exec(`ALTER TABLE events ADD COLUMN source_url TEXT`);
}

export function insertEvent(data: {
  title: string;
  event_date: string | null;
  event_date_text: string | null;
  location: string | null;
  description: string | null;
  source_text: string | null;
  source_chat: string | null;
  source_url: string | null;
}): number {
  const stmt = db.prepare(`
    INSERT INTO events (title, event_date, event_date_text, location, description, source_text, source_chat, source_url)
    VALUES (@title, @event_date, @event_date_text, @location, @description, @source_text, @source_chat, @source_url)
  `);
  const info = stmt.run(data);
  return Number(info.lastInsertRowid);
}

export function updateEvent(
  id: number,
  data: {
    title: string;
    event_date: string | null;
    event_date_text: string | null;
    location: string | null;
    description: string | null;
  }
): boolean {
  const info = db
    .prepare(
      `UPDATE events SET title = @title, event_date = @event_date, event_date_text = @event_date_text,
       location = @location, description = @description WHERE id = @id`
    )
    .run({ ...data, id });
  return info.changes > 0;
}

// Nearest upcoming deadline first, then events with no usable date, then ones whose day
// has already passed — otherwise a deal that expired yesterday would sit at #1 forever.
export function getActiveEvents(now = new Date()): EventRecord[] {
  return db
    .prepare(
      `SELECT * FROM events WHERE status = 'active'
       ORDER BY CASE WHEN event_date IS NULL THEN 1 WHEN event_date < ? THEN 2 ELSE 0 END,
                event_date ASC, created_at ASC`
    )
    .all(atMidnight(now).toISOString()) as EventRecord[];
}

// "Passed" matches what the lists mark with ⌛: an active event dated before today. Times
// aren't shown, so a deal "valid until 30 Oct" counts as current for all of 30 Oct.
export function getPassedEvents(now = new Date()): EventRecord[] {
  return db
    .prepare(
      `SELECT * FROM events WHERE status = 'active'
       AND event_date IS NOT NULL AND event_date < ?
       ORDER BY event_date ASC`
    )
    .all(atMidnight(now).toISOString()) as EventRecord[];
}

export function getEventsInRange(startIso: string, endIso: string): EventRecord[] {
  return db
    .prepare(
      `SELECT * FROM events WHERE status = 'active'
       AND event_date IS NOT NULL AND event_date >= ? AND event_date < ?
       ORDER BY event_date ASC`
    )
    .all(startIso, endIso) as EventRecord[];
}

export function getEvent(id: number): EventRecord | undefined {
  return db.prepare(`SELECT * FROM events WHERE id = ?`).get(id) as EventRecord | undefined;
}

export function markDone(id: number): boolean {
  const info = db.prepare(`UPDATE events SET status = 'done' WHERE id = ?`).run(id);
  return info.changes > 0;
}

export function deleteEvent(id: number): boolean {
  const info = db.prepare(`DELETE FROM events WHERE id = ?`).run(id);
  return info.changes > 0;
}
