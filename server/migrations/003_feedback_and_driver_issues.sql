-- Resident pickup feedback ("Will you put out your garbage today?") and driver
-- problem reports. Both are new tables; no existing data is changed.

-- One row per resident per pickup date (UNIQUE), so a resident is never counted
-- twice for the same day. Answering again updates the row (latest answer kept).
-- These are what the RESIDENT SAID; driver-confirmed pickups stay in
-- collection_records.
CREATE TABLE collection_feedback (
  id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL,
  resident_name TEXT,
  purok TEXT,
  date TEXT NOT NULL,                  -- pickup date (YYYY-MM-DD)
  run_id TEXT,                         -- that day's collection run, if one was started
  will_dispose INTEGER NOT NULL CHECK (will_dispose IN (0, 1)),
  truck_passed INTEGER CHECK (truck_passed IN (0, 1)),   -- NULL = not answered
  disposed INTEGER CHECK (disposed IN (0, 1)),           -- NULL = not answered
  reason TEXT,                         -- why they could not put it out (when disposed = 0)
  reason_text TEXT,
  report_id TEXT,                      -- resident report created from this answer, if any
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (resident_id, date)
);

-- Problems the driver reports (from Home or from a stop).
CREATE TABLE driver_issues (
  id TEXT PRIMARY KEY,
  reported_at TEXT NOT NULL,
  driver_id TEXT,
  driver_name TEXT,
  run_id TEXT,
  stop_id TEXT,                        -- NULL = not at a specific stop
  stop_name TEXT,
  issue_type TEXT NOT NULL,
  issue_label TEXT NOT NULL,
  description TEXT NOT NULL,
  photo TEXT,
  notified_office INTEGER NOT NULL DEFAULT 0,
  marked_missed INTEGER NOT NULL DEFAULT 0
);
