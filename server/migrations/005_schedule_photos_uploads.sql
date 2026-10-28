-- 1. Official collection days: Monday, Wednesday and Friday only.
--    Mon/Wed/Fri keep their saved time windows; other days become "No collection".
--    Waste types are no longer used (residents do not sort waste in the app).
UPDATE schedules SET waste_type = 'Garbage collection' WHERE day IN ('Monday', 'Wednesday', 'Friday');
UPDATE schedules SET waste_type = 'Garbage collection', time_window = '06:00 AM - 10:00 AM'
  WHERE day IN ('Monday', 'Wednesday', 'Friday') AND (time_window IS NULL OR time_window = '-');
UPDATE schedules SET waste_type = 'No collection', time_window = '-' WHERE day NOT IN ('Monday', 'Wednesday', 'Friday');

-- 2. Uploaded images (report photos, driver problem photos, profile pictures).
--    Kept here instead of inside every data snapshot, and only served to
--    signed-in users who may see them (GET /api/images/:id).
CREATE TABLE uploads (
  id TEXT PRIMARY KEY,                 -- random, not guessable
  kind TEXT NOT NULL CHECK (kind IN ('report', 'issue', 'avatar-admin', 'avatar-driver', 'avatar-crew', 'avatar-resident')),
  owner_id TEXT NOT NULL,              -- resident / driver / crew id, or 'ADMIN'
  mime TEXT NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  data BLOB NOT NULL,
  size INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL,           -- role:id of who uploaded it
  created_at TEXT NOT NULL
);

-- 3. Optional profile pictures (a reference like "upl:<id>").
ALTER TABLE drivers ADD COLUMN photo TEXT;
ALTER TABLE crew_members ADD COLUMN photo TEXT;
ALTER TABLE residents ADD COLUMN photo TEXT;

-- 4. Runs on a non-collection day are "special" (office-recorded), never regular.
ALTER TABLE collection_runs ADD COLUMN special INTEGER NOT NULL DEFAULT 0;
