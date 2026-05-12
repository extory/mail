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
      CREATE TABLE IF NOT EXISTS sent_emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        send_log_id INTEGER NOT NULL,
        resend_id TEXT UNIQUE NOT NULL,
        recipient_email TEXT NOT NULL,
        last_event TEXT DEFAULT 'sent',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (send_log_id) REFERENCES send_log(id)
      );
      CREATE TABLE IF NOT EXISTS email_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resend_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        data TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS subscriber_groups (
        subscriber_id INTEGER NOT NULL,
        group_id INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (subscriber_id, group_id),
        FOREIGN KEY (subscriber_id) REFERENCES subscribers(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_sent_emails_send_log ON sent_emails(send_log_id);
      CREATE INDEX IF NOT EXISTS idx_sent_emails_resend_id ON sent_emails(resend_id);
      CREATE INDEX IF NOT EXISTS idx_email_events_resend_id ON email_events(resend_id);
      CREATE INDEX IF NOT EXISTS idx_subscriber_groups_group ON subscriber_groups(group_id);
      CREATE INDEX IF NOT EXISTS idx_subscriber_groups_subscriber ON subscriber_groups(subscriber_id);
    `);

    // One-time migration: move legacy single group_id into join table
    const migrated = db.prepare("SELECT COUNT(*) as c FROM subscriber_groups").get() as { c: number };
    if (migrated.c === 0) {
      db.exec(`
        INSERT OR IGNORE INTO subscriber_groups (subscriber_id, group_id)
        SELECT id, group_id FROM subscribers WHERE group_id IS NOT NULL
      `);
    }
  }
  return db;
}

// --- Groups ---

export function getGroups(): Group[] {
  const db = getDb();
  return db
    .prepare(`
      SELECT g.*, COUNT(DISTINCT sg.subscriber_id) as subscriber_count
      FROM groups g
      LEFT JOIN subscriber_groups sg ON sg.group_id = g.id
      LEFT JOIN subscribers s ON s.id = sg.subscriber_id AND s.status = 'active'
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
  db.prepare("DELETE FROM subscriber_groups WHERE group_id = ?").run(id);
  db.prepare("DELETE FROM groups WHERE id = ?").run(id);
}

// --- Subscribers ---

interface RawSubscriberRow {
  id: number;
  email: string;
  name: string | null;
  created_at: string;
  status: "active" | "unsubscribed";
}

function attachGroups(rows: RawSubscriberRow[]): Subscriber[] {
  if (rows.length === 0) return [];
  const db = getDb();
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const groupRows = db
    .prepare(`
      SELECT sg.subscriber_id, g.id as gid, g.name as gname
      FROM subscriber_groups sg
      JOIN groups g ON g.id = sg.group_id
      WHERE sg.subscriber_id IN (${placeholders})
      ORDER BY g.name
    `)
    .all(...ids) as { subscriber_id: number; gid: number; gname: string }[];

  const byId = new Map<number, { id: number; name: string }[]>();
  for (const r of rows) byId.set(r.id, []);
  for (const g of groupRows) {
    byId.get(g.subscriber_id)?.push({ id: g.gid, name: g.gname });
  }

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    created_at: r.created_at,
    status: r.status,
    groups: byId.get(r.id) || [],
  }));
}

export function getSubscribers(search?: string, groupId?: number): Subscriber[] {
  const db = getDb();
  let sql = `
    SELECT s.id, s.email, s.name, s.created_at, s.status
    FROM subscribers s
    WHERE s.status = 'active'
  `;
  const params: (string | number)[] = [];

  if (search) {
    sql += " AND (s.email LIKE ? OR s.name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }
  if (groupId !== undefined) {
    if (groupId === 0) {
      sql += " AND NOT EXISTS (SELECT 1 FROM subscriber_groups sg2 WHERE sg2.subscriber_id = s.id)";
    } else {
      sql += " AND EXISTS (SELECT 1 FROM subscriber_groups sg2 WHERE sg2.subscriber_id = s.id AND sg2.group_id = ?)";
      params.push(groupId);
    }
  }

  sql += " ORDER BY s.created_at DESC";
  const rows = db.prepare(sql).all(...params) as RawSubscriberRow[];
  return attachGroups(rows);
}

export function getSubscriberCount(): number {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) as count FROM subscribers WHERE status = 'active'")
    .get() as { count: number };
  return row.count;
}

function setSubscriberGroups(subscriberId: number, groupIds: number[]): void {
  const db = getDb();
  db.prepare("DELETE FROM subscriber_groups WHERE subscriber_id = ?").run(subscriberId);
  if (groupIds.length === 0) return;
  const insert = db.prepare("INSERT OR IGNORE INTO subscriber_groups (subscriber_id, group_id) VALUES (?, ?)");
  const tx = db.transaction(() => {
    for (const gid of groupIds) insert.run(subscriberId, gid);
  });
  tx();
}

function addToGroups(subscriberId: number, groupIds: number[]): void {
  if (groupIds.length === 0) return;
  const db = getDb();
  const insert = db.prepare("INSERT OR IGNORE INTO subscriber_groups (subscriber_id, group_id) VALUES (?, ?)");
  const tx = db.transaction(() => {
    for (const gid of groupIds) insert.run(subscriberId, gid);
  });
  tx();
}

function getSubscriberById(id: number): Subscriber | undefined {
  const db = getDb();
  const row = db.prepare(`
    SELECT s.id, s.email, s.name, s.created_at, s.status
    FROM subscribers s WHERE s.id = ?
  `).get(id) as RawSubscriberRow | undefined;
  if (!row) return undefined;
  return attachGroups([row])[0];
}

export function addSubscriber(email: string, name?: string, groupIds?: number[]): Subscriber {
  const db = getDb();
  db.prepare(
    "INSERT INTO subscribers (email, name) VALUES (?, ?) ON CONFLICT(email) DO UPDATE SET status = 'active', name = COALESCE(?, name)"
  ).run(email, name || null, name || null);

  const sub = db.prepare("SELECT id FROM subscribers WHERE email = ?").get(email) as { id: number };
  if (groupIds && groupIds.length > 0) {
    addToGroups(sub.id, groupIds);
  }

  return getSubscriberById(sub.id)!;
}

export function updateSubscriberGroups(id: number, groupIds: number[]): void {
  setSubscriberGroups(id, groupIds);
}

export function removeSubscriber(id: number): void {
  const db = getDb();
  db.prepare("UPDATE subscribers SET status = 'unsubscribed' WHERE id = ?").run(id);
}

export function unsubscribeByEmail(email: string): boolean {
  const db = getDb();
  const result = db.prepare("UPDATE subscribers SET status = 'unsubscribed' WHERE email = ? AND status = 'active'").run(email);
  return result.changes > 0;
}

export function importSubscribers(
  rows: { email: string; name?: string }[],
  groupIds?: number[]
): { imported: number; skipped: number } {
  const db = getDb();
  const insertSub = db.prepare(
    "INSERT INTO subscribers (email, name) VALUES (?, ?) ON CONFLICT(email) DO NOTHING"
  );
  const insertGroup = db.prepare(
    "INSERT OR IGNORE INTO subscriber_groups (subscriber_id, group_id) VALUES ((SELECT id FROM subscribers WHERE email = ?), ?)"
  );
  const transaction = db.transaction(() => {
    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const result = insertSub.run(row.email, row.name || null);
      if (result.changes > 0) imported++;
      else skipped++;
      if (groupIds && groupIds.length > 0) {
        for (const gid of groupIds) insertGroup.run(row.email, gid);
      }
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

export function getUserCount(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  return row.count;
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

export function updateUserPassword(id: number, passwordHash: string): void {
  const db = getDb();
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, id);
}

export function getUserById(id: number): DbUser | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as DbUser | undefined;
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

// --- Sent Emails & Events ---

export function saveSentEmail(sendLogId: number, resendId: string, recipientEmail: string): void {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO sent_emails (send_log_id, resend_id, recipient_email) VALUES (?, ?, ?)")
    .run(sendLogId, resendId, recipientEmail);
}

export function recordEmailEvent(resendId: string, eventType: string, data?: string): void {
  const db = getDb();
  db.prepare("INSERT INTO email_events (resend_id, event_type, data) VALUES (?, ?, ?)").run(resendId, eventType, data || null);
  db.prepare("UPDATE sent_emails SET last_event = ? WHERE resend_id = ?").run(eventType, resendId);
}

export interface SendLogStats {
  send_log_id: number;
  subject: string;
  sent_at: string;
  recipient_count: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
}

export function getSendLogStats(): SendLogStats[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      sl.id as send_log_id,
      sl.subject,
      sl.sent_at,
      sl.recipient_count,
      COALESCE(COUNT(se.id), 0) as sent,
      COALESCE(SUM(CASE WHEN se.last_event = 'delivered' THEN 1 ELSE 0 END), 0) as delivered,
      COALESCE(SUM(CASE WHEN se.last_event = 'opened' THEN 1 ELSE 0 END), 0) as opened,
      COALESCE(SUM(CASE WHEN se.last_event = 'clicked' THEN 1 ELSE 0 END), 0) as clicked,
      COALESCE(SUM(CASE WHEN se.last_event = 'bounced' THEN 1 ELSE 0 END), 0) as bounced,
      COALESCE(SUM(CASE WHEN se.last_event = 'complained' THEN 1 ELSE 0 END), 0) as complained,
      COALESCE(SUM(CASE WHEN se.last_event = 'failed' THEN 1 ELSE 0 END), 0) as failed
    FROM send_log sl
    LEFT JOIN sent_emails se ON se.send_log_id = sl.id
    GROUP BY sl.id
    ORDER BY sl.sent_at DESC
  `).all() as SendLogStats[];
}

export function getOverallStats(): {
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_bounced: number;
  total_failed: number;
} {
  const db = getDb();
  return db.prepare(`
    SELECT
      COUNT(*) as total_sent,
      SUM(CASE WHEN last_event = 'delivered' THEN 1 ELSE 0 END) as total_delivered,
      SUM(CASE WHEN last_event = 'opened' THEN 1 ELSE 0 END) as total_opened,
      SUM(CASE WHEN last_event = 'clicked' THEN 1 ELSE 0 END) as total_clicked,
      SUM(CASE WHEN last_event = 'bounced' THEN 1 ELSE 0 END) as total_bounced,
      SUM(CASE WHEN last_event = 'failed' THEN 1 ELSE 0 END) as total_failed
    FROM sent_emails
  `).get() as { total_sent: number; total_delivered: number; total_opened: number; total_clicked: number; total_bounced: number; total_failed: number };
}

// --- Dashboard ---

export function getDashboardData() {
  const db = getDb();

  const subscriberCount = (db.prepare("SELECT COUNT(*) as c FROM subscribers WHERE status = 'active'").get() as { c: number }).c;
  const unsubscribedCount = (db.prepare("SELECT COUNT(*) as c FROM subscribers WHERE status = 'unsubscribed'").get() as { c: number }).c;
  const groupCount = (db.prepare("SELECT COUNT(*) as c FROM groups").get() as { c: number }).c;
  const draftCount = (db.prepare("SELECT COUNT(*) as c FROM drafts").get() as { c: number }).c;
  const campaignCount = (db.prepare("SELECT COUNT(*) as c FROM send_log").get() as { c: number }).c;

  const groups = db.prepare(`
    SELECT g.name, COUNT(DISTINCT sg.subscriber_id) as count
    FROM groups g
    LEFT JOIN subscriber_groups sg ON sg.group_id = g.id
    LEFT JOIN subscribers s ON s.id = sg.subscriber_id AND s.status = 'active'
    GROUP BY g.id ORDER BY count DESC LIMIT 5
  `).all() as { name: string; count: number }[];

  const emailStats = db.prepare(`
    SELECT
      COALESCE(COUNT(*), 0) as total_sent,
      COALESCE(SUM(CASE WHEN last_event IN ('delivered','opened','clicked') THEN 1 ELSE 0 END), 0) as total_delivered,
      COALESCE(SUM(CASE WHEN last_event IN ('opened','clicked') THEN 1 ELSE 0 END), 0) as total_opened,
      COALESCE(SUM(CASE WHEN last_event = 'clicked' THEN 1 ELSE 0 END), 0) as total_clicked,
      COALESCE(SUM(CASE WHEN last_event = 'bounced' THEN 1 ELSE 0 END), 0) as total_bounced,
      COALESCE(SUM(CASE WHEN last_event = 'failed' THEN 1 ELSE 0 END), 0) as total_failed
    FROM sent_emails
  `).get() as { total_sent: number; total_delivered: number; total_opened: number; total_clicked: number; total_bounced: number; total_failed: number };

  const recentCampaigns = db.prepare(`
    SELECT sl.subject, sl.sent_at, sl.recipient_count, sl.status
    FROM send_log sl ORDER BY sl.sent_at DESC LIMIT 5
  `).all() as { subject: string; sent_at: string; recipient_count: number; status: string }[];

  return {
    subscriberCount,
    unsubscribedCount,
    groupCount,
    draftCount,
    campaignCount,
    groups,
    emailStats,
    recentCampaigns,
  };
}
