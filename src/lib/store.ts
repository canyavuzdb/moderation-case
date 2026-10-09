import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { evaluate } from "./moderation";
import { needsExplanation, type Comment, type Assessment, type DecisionEvent } from "./types";

export class ValidationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function validateComment(input: unknown): string {
  if (typeof input !== "string" || !input.trim() || input.length > 2000)
    throw new ValidationError("Yorum 1–2000 karakter olmalı ve yalnızca boşluk içermemeli.");
  return input.trim();
}
export function openStore(path = process.env.MODERATION_DB_PATH || resolve("data/moderation.db")) {
  if (path !== ":memory:") mkdirSync(dirname(resolve(/* turbopackIgnore: true */ path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY, text TEXT NOT NULL, created_at TEXT NOT NULL,
      assessment TEXT NOT NULL, decision TEXT CHECK(decision IN ('approved','rejected')),
      note TEXT NOT NULL DEFAULT '', decided_at TEXT, seed_key TEXT UNIQUE
    );
    CREATE TABLE IF NOT EXISTS decision_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id TEXT NOT NULL REFERENCES comments(id),
      decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),
      note TEXT NOT NULL, decided_at TEXT NOT NULL, legacy INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS history_comment ON decision_history(comment_id, id);
    INSERT INTO decision_history (comment_id, decision, note, decided_at, legacy)
      SELECT id, decision, note, decided_at, 1 FROM comments
      WHERE decision IS NOT NULL AND decided_at IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM decision_history WHERE comment_id = comments.id);`);
  const select = `SELECT id, text, created_at AS createdAt, assessment, decision,
    note, decided_at AS decidedAt FROM comments`;
  function decode(row: Record<string, unknown>): Comment {
    const history = db.prepare("SELECT id, decision, note, decided_at AS decidedAt, legacy FROM decision_history WHERE comment_id = ? ORDER BY id DESC")
      .all(String(row.id)).map((entry) => ({ ...entry, legacy: Boolean(entry.legacy) })) as DecisionEvent[];
    return { ...row, assessment: JSON.parse(String(row.assessment)), history } as Comment;
  }
  function list() { return db.prepare(select + " ORDER BY created_at DESC, rowid DESC").all().map(decode); }
  function get(id: string) {
    const row = db.prepare(select + " WHERE id = ?").get(id);
    return row ? decode(row) : undefined;
  }
  function insert(text: string, seedKey: string | null = null, createdAt = new Date().toISOString(), assessment = evaluate(text)) {
    const id = randomUUID();
    db.prepare("INSERT INTO comments (id, text, created_at, assessment, seed_key) VALUES (?, ?, ?, ?, ?)")
      .run(id, text, createdAt, JSON.stringify(assessment), seedKey);
    return get(id)!;
  }
  function create(input: unknown, assessment?: Assessment) {
    const text = validateComment(input);
    return insert(text, null, undefined, assessment);
  }
  function writeDecision(id: string, decision: "approved" | "rejected", note: string) {
        const decidedAt = new Date().toISOString();
        db.prepare("INSERT INTO decision_history (comment_id, decision, note, decided_at) VALUES (?, ?, ?, ?)")
          .run(id, decision, note, decidedAt);
        db.prepare("UPDATE comments SET decision = ?, note = ?, decided_at = ? WHERE id = ?")
          .run(decision, note, decidedAt, id);
  }
  function decide(id: string, decision: unknown, input: unknown = "") {
    if (decision !== "approved" && decision !== "rejected") throw new ValidationError("Geçerli bir karar seçin.");
    if (typeof input !== "string" || input.length > 500) throw new ValidationError("Açıklama en fazla 500 karakter olabilir.");
    const comment = get(id);
    if (!comment) throw new ValidationError("Yorum bulunamadı.", 404);
    const note = input.trim();
    if (needsExplanation(comment.assessment.outcome, decision) && !note)
      throw new ValidationError("Sistem önerisinden farklı karar için kısa bir açıklama yazın.");
    db.exec("BEGIN IMMEDIATE");
    try {
      const current = get(id)!;
      if (current.decision !== decision || current.note !== note) {
        writeDecision(id, decision, note);
      }
      const result = get(id)!;
      db.exec("COMMIT");
      return result;
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  return { list, get, create, decide, close: () => db.close() };
}
export function withStore<T>(action: (store: ReturnType<typeof openStore>) => T): T {
  const store = openStore();
  try { return action(store); } finally { store.close(); }
}
