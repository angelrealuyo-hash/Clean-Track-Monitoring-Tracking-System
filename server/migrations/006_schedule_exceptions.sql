-- Holidays and collection suspensions set by the admin (Routes & Schedules).
-- A listed date has NO regular pickup, even on Monday, Wednesday or Friday.
CREATE TABLE schedule_exceptions (
  date TEXT PRIMARY KEY,               -- YYYY-MM-DD
  kind TEXT NOT NULL CHECK (kind IN ('holiday', 'suspended')),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
