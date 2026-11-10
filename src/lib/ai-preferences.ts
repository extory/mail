import { getDb } from "./db";
import type { AIProvider } from "./ai-model-types";

function preferencesDb() {
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS user_ai_preferences (
    user_id INTEGER PRIMARY KEY,
    provider TEXT NOT NULL CHECK(provider IN ('openai', 'gemini')),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  return db;
}

export function getAIProviderPreference(userId: number): AIProvider | null {
  const row = preferencesDb().prepare("SELECT provider FROM user_ai_preferences WHERE user_id = ?").get(userId) as { provider: AIProvider } | undefined;
  return row?.provider ?? null;
}

export function setAIProviderPreference(userId: number, provider: AIProvider): void {
  preferencesDb().prepare("INSERT INTO user_ai_preferences(user_id, provider) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET provider = excluded.provider").run(userId, provider);
}
