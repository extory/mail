import Database from "better-sqlite3";
import path from "path";
import type { Subscriber, SendLog, Group, Draft } from "./types";

const DB_PATH = path.join(process.cwd(), "data", "mail.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS invitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        code TEXT UNIQUE NOT NULL,
        invited_by INTEGER NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (invited_by) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        group_id INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        status TEXT DEFAULT 'active',
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS drafts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL DEFAULT '',
        html_content TEXT NOT NULL DEFAULT '',
        prompt TEXT NOT NULL DEFAULT '',
        updated_at TEXT DEFAULT (datetime('now'))
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

// --- Groups ---

export function getGroups(): Group[] {
  const db = getDb();
  return db
    .prepare(`
      SELECT g.*, COUNT(s.id) as subscriber_count
      FROM groups g
      LEFT JOIN subscribers s ON s.group_id = g.id AND s.status = 'active'
      GROUP BY g.id
      ORDER BY g.name
    `)
    .all() as Group[];
}

export function addGroup(name: string): Group {
  const db = getDb();
  const result = db.prepare("INSERT INTO groups (name) VALUES (?)").run(name);
  return db.prepare("SELECT *, 0 as subscriber_count FROM groups WHERE id = ?").get(result.lastInsertRowid) as Group;
}

export function deleteGroup(id: number): void {
  const db = getDb();
  db.prepare("UPDATE subscribers SET group_id = NULL WHERE group_id = ?").run(id);
  db.prepare("DELETE FROM groups WHERE id = ?").run(id);
}

// --- Subscribers ---

export function getSubscribers(search?: string, groupId?: number): Subscriber[] {
  const db = getDb();
  let sql = `
    SELECT s.*, g.name as group_name
    FROM subscribers s
    LEFT JOIN groups g ON s.group_id = g.id
    WHERE s.status = 'active'
  `;
  const params: (string | number)[] = [];

  if (search) {
    sql += " AND (s.email LIKE ? OR s.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (groupId !== undefined) {
    if (groupId === 0) {
      sql += " AND s.group_id IS NULL";
    } else {
      sql += " AND s.group_id = ?";
      params.push(groupId);
    }
  }

  sql += " ORDER BY s.created_at DESC";
  return db.prepare(sql).all(...params) as Subscriber[];
}

export function getSubscriberCount(): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) as count FROM subscribers WHERE status = 'active'")
    .get() as { count: number };
  return row.count;
}

export function addSubscriber(email: string, name?: string, groupId?: number): Subscriber {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO subscribers (email, name, group_id) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET status = 'active', name = COALESCE(?, name), group_id = COALESCE(?, group_id)"
  );
  stmt.run(email, name || null, groupId || null, name || null, groupId || null);
  return db
    .prepare("SELECT s.*, g.name as group_name FROM subscribers s LEFT JOIN groups g ON s.group_id = g.id WHERE s.email = ?")
    .get(email) as Subscriber;
}

export function updateSubscriberGroup(id: number, groupId: number | null): void {
  const db = getDb();
  db.prepare("UPDATE subscribers SET group_id = ? WHERE id = ?").run(groupId, id);
}

export function removeSubscriber(id: number): void {
  const db = getDb();
  db.prepare("UPDATE subscribers SET status = 'unsubscribed' WHERE id = ?").run(id);
}

export function importSubscribers(
  rows: { email: string; name?: string }[],
  groupId?: number
): { imported: number; skipped: number } {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO subscribers (email, name, group_id) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING"
  );
  const transaction = db.transaction(() => {
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const result = stmt.run(row.email, row.name || null, groupId || null);
      if (result.changes > 0) imported++;
      else skipped++;
    }
    return { imported, skipped };
  });
  return transaction();
}

// --- Drafts ---

export function getDrafts(): Draft[] {
  const db = getDb();
  return db.prepare("SELECT * FROM drafts ORDER BY updated_at DESC").all() as Draft[];
}

export function getDraft(id: number): Draft | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM drafts WHERE id = ?").get(id) as Draft | undefined;
}

export function saveDraft(subject: string, htmlContent: string, prompt: string, id?: number): Draft {
  const db = getDb();
  if (id) {
    db.prepare("UPDATE drafts SET subject = ?, html_content = ?, prompt = ?, updated_at = datetime('now') WHERE id = ?")
      .run(subject, htmlContent, prompt, id);
    return db.prepare("SELECT * FROM drafts WHERE id = ?").get(id) as Draft;
  }
  const result = db.prepare("INSERT INTO drafts (subject, html_content, prompt) VALUES (?, ?, ?)").run(subject, htmlContent, prompt);
  return db.prepare("SELECT * FROM drafts WHERE id = ?").get(result.lastInsertRowid) as Draft;
}

export function deleteDraft(id: number): void {
  const db = getDb();
  db.prepare("DELETE FROM drafts WHERE id = ?").run(id);
}

// --- Users ---

export interface DbUser {
  id: number;
  email: string;
  password_hash: string;
  role: string;
  created_at: string;
}

export function getUserByEmail(email: string): DbUser | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as DbUser | undefined;
}

export function createUser(email: string, passwordHash: string, role: string = "user"): DbUser {
  const db = getDb();
  const result = db.prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)").run(email, passwordHash, role);
  return db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid) as DbUser;
}

// --- Invitations ---

export interface DbInvitation {
  id: number;
  email: string;
  code: string;
  invited_by: number;
  used: number;
  created_at: string;
}

export function createInvitation(email: string, code: string, invitedBy: number): DbInvitation {
  const db = getDb();
  const result = db.prepare("INSERT INTO invitations (email, code, invited_by) VALUES (?, ?, ?)").run(email, code, invitedBy);
  return db.prepare("SELECT * FROM invitations WHERE id = ?").get(result.lastInsertRowid) as DbInvitation;
}

export function getInvitationByCode(code: string): DbInvitation | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM invitations WHERE code = ? AND used = 0").get(code) as DbInvitation | undefined;
}

export function markInvitationUsed(id: number): void {
  const db = getDb();
  db.prepare("UPDATE invitations SET used = 1 WHERE id = ?").run(id);
}

export function getInvitations(): DbInvitation[] {
  const db = getDb();
  return db.prepare("SELECT * FROM invitations ORDER BY created_at DESC").all() as DbInvitation[];
}

export function deleteInvitation(id: number): void {
  const db = getDb();
  db.prepare("DELETE FROM invitations WHERE id = ?").run(id);
}

// --- Send Log ---

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
