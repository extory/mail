import Database from "better-sqlite3";
import path from "path";

export async function GET() {
  const db = new Database(path.join(process.cwd(), "data", "mail.db"));
  try {
    const sendLogCount = (db.prepare("SELECT COUNT(*) as c FROM send_log").get() as { c: number }).c;
    const sentEmailCount = (db.prepare("SELECT COUNT(*) as c FROM sent_emails").get() as { c: number }).c;
    const eventCount = (db.prepare("SELECT COUNT(*) as c FROM email_events").get() as { c: number }).c;

    const recentSentEmails = db
      .prepare("SELECT id, send_log_id, resend_id, recipient_email, last_event, created_at FROM sent_emails ORDER BY id DESC LIMIT 10")
      .all();

    const eventsByType = db
      .prepare("SELECT event_type, COUNT(*) as count FROM email_events GROUP BY event_type ORDER BY count DESC")
      .all();

    const recentEvents = db
      .prepare("SELECT resend_id, event_type, created_at FROM email_events ORDER BY id DESC LIMIT 10")
      .all();

    const recentSendLogs = db
      .prepare("SELECT id, subject, recipient_count, status, sent_at FROM send_log ORDER BY id DESC LIMIT 5")
      .all();

    // Sample joined view: do sent_emails actually link back to send_log?
    const orphaned = (db.prepare(`
      SELECT COUNT(*) as c FROM sent_emails se
      LEFT JOIN send_log sl ON sl.id = se.send_log_id
      WHERE sl.id IS NULL
    `).get() as { c: number }).c;

    return Response.json({
      counts: { sendLogCount, sentEmailCount, eventCount, orphanedSentEmails: orphaned },
      eventsByType,
      recentSendLogs,
      recentSentEmails,
      recentEvents,
    });
  } finally {
    db.close();
  }
}
