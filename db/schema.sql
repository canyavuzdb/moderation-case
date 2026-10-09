-- Mevcut SQLite şeması. Kullanıcı verisi içermez.

CREATE TABLE comments (
      id TEXT PRIMARY KEY, text TEXT NOT NULL, created_at TEXT NOT NULL,
      assessment TEXT NOT NULL, decision TEXT CHECK(decision IN ('approved','rejected')),
      note TEXT NOT NULL DEFAULT '', decided_at TEXT, seed_key TEXT UNIQUE
    );

CREATE TABLE decision_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id TEXT NOT NULL REFERENCES comments(id),
      decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),
      note TEXT NOT NULL, decided_at TEXT NOT NULL, legacy INTEGER NOT NULL DEFAULT 0
    );

CREATE INDEX history_comment ON decision_history(comment_id, id);
