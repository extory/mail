import { randomUUID } from "node:crypto";
import { getDb, saveSentEmail } from "./db";
import type { SendLog } from "./types";
import { isValidEmail } from "./validation";

export type RecipientState = "pending" | "sending" | "accepted" | "failed" | "blocked" | "unknown" | "skipped";
export interface TrackedRecipient {
  id: number; send_log_id: number; email: string; name: string | null;
  state: RecipientState; error: string | null; resend_id: string | null;
}
const LEASE_MS = 10 * 60 * 1000;
function db() {
  const connection = getDb();
  connection.exec(`CREATE TABLE IF NOT EXISTS send_tracking (
    send_log_id INTEGER PRIMARY KEY, embed_images INTEGER NOT NULL DEFAULT 0,
    lock_token TEXT, lock_until INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS send_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT, send_log_id INTEGER NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE, name TEXT, state TEXT NOT NULL DEFAULT 'pending',
    error TEXT, resend_id TEXT, UNIQUE(send_log_id,email));
    CREATE INDEX IF NOT EXISTS idx_send_recipients_log ON send_recipients(send_log_id,state);`);
  return connection;
}
export function recipientProblem(email: string): string | null {
  if (!isValidEmail(email)) return "Invalid email address";
  const domain = email.split("@")[1].toLowerCase();
  if (["example.com", "example.net", "example.org"].some(d => domain === d || domain.endsWith(`.${d}`)) ||
      /\.(invalid|test|example|localhost)$/.test(domain)) return "Reserved example/test domain: replace with a real recipient address";
  return null;
}
export function initializeSend(id: number, recipients: {email: string; name: string | null}[], embedImages: boolean) {
  const connection = db();
  connection.transaction(() => {
    if (connection.prepare("SELECT 1 FROM send_tracking WHERE send_log_id = ?").get(id)) return;
    connection.prepare("INSERT INTO send_tracking (send_log_id,embed_images) VALUES (?,?)").run(id, Number(embedImages));
    const insert = connection.prepare("INSERT OR IGNORE INTO send_recipients (send_log_id,email,name,state,error) VALUES (?,?,?,?,?)");
    for (const recipient of recipients) {
      const email = recipient.email.trim().toLowerCase();
      const error = recipientProblem(email);
      insert.run(id, email, recipient.name, error ? "blocked" : "pending", error);
    }
  })();
}
export function getSendReport(id: number) {
  const connection = db();
  const log = connection.prepare("SELECT * FROM send_log WHERE id = ?").get(id) as SendLog | undefined;
  if (!log) return null;
  const tracking = connection.prepare("SELECT * FROM send_tracking WHERE send_log_id = ?").get(id) as {embed_images: number; lock_until: number; lock_token: string | null} | undefined;
  const recipients = connection.prepare("SELECT * FROM send_recipients WHERE send_log_id = ? ORDER BY id").all(id) as TrackedRecipient[];
  const accepted = connection.prepare("SELECT recipient_email, resend_id FROM sent_emails WHERE send_log_id = ?").all(id) as {recipient_email: string; resend_id: string}[];
  const count = (state: RecipientState) => recipients.filter(r => r.state === state).length;
  const active = new Set((connection.prepare("SELECT email FROM subscribers WHERE status = 'active'").all() as {email: string}[]).map(r => r.email.toLowerCase()));
  const retryable = recipients.filter(r => ["pending", "failed"].includes(r.state) && active.has(r.email.toLowerCase()) && !recipientProblem(r.email)).length;
  return { log, tracked: !!tracking, embedImages: tracking?.embed_images === 1,
    busy: !!tracking?.lock_token && tracking.lock_until > Date.now(), recipients, accepted,
    total: recipients.length, success: count("accepted"), failed: count("failed"), blocked: count("blocked"),
    unknown: count("unknown") + count("sending"), pending: count("pending"), skipped: count("skipped"), retryable };
}
export function claimSend(id: number): string | null {
  const connection = db();
  return connection.transaction(() => {
    const token = randomUUID();
    const result = connection.prepare("UPDATE send_tracking SET lock_token = ?, lock_until = ? WHERE send_log_id = ? AND (lock_token IS NULL OR lock_until <= ?)").run(token, Date.now()+LEASE_MS, id, Date.now());
    if (!result.changes) return null;
    connection.prepare("UPDATE send_recipients SET state = 'unknown', error = 'Previous request interrupted; verify with Resend before any resend' WHERE send_log_id = ? AND state = 'sending'").run(id);
    return token;
  })();
}
export function heartbeatSend(id: number, token: string) {
  if (!db().prepare("UPDATE send_tracking SET lock_until = ? WHERE send_log_id = ? AND lock_token = ?").run(Date.now()+LEASE_MS,id,token).changes) throw new Error("Send lock lost");
}
export function setRecipientResult(recipient: TrackedRecipient, state: RecipientState, error?: string, resendId?: string) {
  const connection = db();
  connection.transaction(() => {
    connection.prepare("UPDATE send_recipients SET state = ?, error = ?, resend_id = COALESCE(?,resend_id) WHERE id = ?").run(state,error || null,resendId || null,recipient.id);
    if (resendId) saveSentEmail(recipient.send_log_id,resendId,recipient.email);
  })();
}
export function finishSend(id: number, token: string) {
  const connection = db();
  connection.transaction(() => {
    if (!connection.prepare("SELECT 1 FROM send_tracking WHERE send_log_id = ? AND lock_token = ?").get(id,token)) return;
    connection.prepare("UPDATE send_recipients SET state = 'unknown', error = 'Request interrupted; verify with Resend' WHERE send_log_id = ? AND state = 'sending'").run(id);
    const report = getSendReport(id)!;
    const status = report.success === report.total ? "sent" : report.success ? "partial" : "failed";
    connection.prepare("UPDATE send_log SET recipient_count = ?, status = ? WHERE id = ?").run(report.success,status,id);
    connection.prepare("UPDATE send_tracking SET lock_token = NULL, lock_until = 0 WHERE send_log_id = ? AND lock_token = ?").run(id,token);
  })();
}
// Older sends did not store targets. Reconstruct only from an explicitly supplied
// original recipient list, with complete real provider IDs and a completed send.
export function recoverLegacySend(id: number, emails: string[], embedImages: boolean) {
  const connection = db();
  return connection.transaction(() => {
    const report = getSendReport(id);
    if (!report || report.tracked || !["partial", "failed"].includes(report.log.status)) throw new Error("This history cannot be reconstructed");
    if (report.accepted.length !== report.log.recipient_count || report.accepted.some(r => r.resend_id.startsWith("local-"))) throw new Error("Incomplete provider IDs; reconcile with Resend first");
    const originals = new Set(emails.map(e => e.trim().toLowerCase()));
    if (!originals.size || [...originals].some(e => !isValidEmail(e)) || report.accepted.some(r => !originals.has(r.recipient_email.toLowerCase()))) throw new Error("Provide the complete original recipient list, including successful recipients");
    const current = connection.prepare("SELECT email,name FROM subscribers").all() as {email:string;name:string|null}[];
    initializeSend(id,[...originals].map(email => ({email,name:current.find(r => r.email.toLowerCase()===email)?.name || null})),embedImages);
    for (const sent of report.accepted) connection.prepare("UPDATE send_recipients SET state = 'accepted', error = NULL, resend_id = ? WHERE send_log_id = ? AND email = ? COLLATE NOCASE").run(sent.resend_id,id,sent.recipient_email);
    return getSendReport(id);
  })();
}
