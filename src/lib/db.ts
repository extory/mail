import Database from "better-sqlite3";
import path from "path";
import type { Subscriber, SendLog } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "mail.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        status TEXT DEFAULT 'active'
      );
      CREATE TABLE IF NOT EXISTS send_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL,
        html_content TEXT NOT NULL,
        recipient_count INTEGER,
        sent_at TEXT DEFAULT (datetime('now')),
        status TEXT DEFAULT 'sent',
        prompt TEXT
      );
    `);
  }
  return db;
}

export function getSubscribers(search?: string): Subscriber[] {
  const db = getDb();
  if (search) {
    return db
      .prepare(
        "SELECT * FROM subscribers WHERE status = 'active' AND (email LIKE ? OR name LIKE ?) ORDER BY created_at DESC"
      )
      .all(`%${search}%`, `%${search}%`) as Subscriber[];
  }
  return db
    .prepare("SELECT * FROM subscribers WHERE status = 'active' ORDER BY created_at DESC")
    .all() as Subscriber[];
}

export function getSubscriberCount(): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) as count FROM subscribers WHERE status = 'active'")
    .get() as { count: number };
  return row.count;
}

export function addSubscriber(email: string, name?: string): Subscriber {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO subscribers (email, name) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET status = 'active', name = COALESCE(?, name)"
  );
  stmt.run(email, name || null, name || null);
  return db
    .prepare("SELECT * FROM subscribers WHERE email = ?")
    .get(email) as Subscriber;
}

export function removeSubscriber(id: number): void {
  const db = getDb();
  db.prepare("UPDATE subscribers SET status = 'unsubscribed' WHERE id = ?").run(id);
}

export function importSubscribers(
  rows: { email: string; name?: string }[]
): { imported: number; skipped: number } {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO subscribers (email, name) VALUES (?, ?) ON CONFLICT(email) DO NOTHING"
  );
  const transaction = db.transaction(() => {
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const result = stmt.run(row.email, row.name || null);
      if (result.changes > 0) imported++;
      else skipped++;
    }
    return { imported, skipped };
  });
  return transaction();
}

export function addSendLog(
  subject: string,
  htmlContent: string,
  recipientCount: number,
  status: string,
  prompt?: string
): SendLog {
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO send_log (subject, html_content, recipient_count, status, prompt) VALUES (?, ?, ?, ?, ?)"
    )
    .run(subject, htmlContent, recipientCount, status, prompt || null);
  return db
    .prepare("SELECT * FROM send_log WHERE id = ?")
    .get(result.lastInsertRowid) as SendLog;
}

export function getSendLogs(): SendLog[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM send_log ORDER BY sent_at DESC")
    .all() as SendLog[];
}
