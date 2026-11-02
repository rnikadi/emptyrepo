CREATE TABLE IF NOT EXISTS days (
  day           date PRIMARY KEY,
  intention     text        NOT NULL DEFAULT '',
  focus_minutes integer     NOT NULL DEFAULT 0 CHECK (focus_minutes >= 0),
  tasks         jsonb       NOT NULL DEFAULT '[]',
  updated_at    timestamptz NOT NULL DEFAULT now()
);
