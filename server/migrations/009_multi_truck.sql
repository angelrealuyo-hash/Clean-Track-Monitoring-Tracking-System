-- Multiple trucks operating independently. ADDITIVE ONLY: no table, row or
-- column is dropped or renamed, so existing records stay as they are.
--
-- Before this migration there was one GPS simulation (simulation_state, id = 1)
-- and one active route run (meta.active_run_id) for the whole barangay. Each
-- truck now has its own session. The old row and meta key are left in place
-- (the app keeps them in step with the first truck that has a route), so older
-- code can still read them after a rollback.

-- 1. One tracking session per truck.
CREATE TABLE truck_sessions (
  truck_id      TEXT PRIMARY KEY,
  sim_status    TEXT NOT NULL DEFAULT 'idle',
  started_at    TEXT,
  paused_at     TEXT,
  stopped_at    TEXT,
  paused_ms     INTEGER NOT NULL DEFAULT 0,
  active_run_id TEXT                         -- this truck's route run in progress
);

-- Carry the current single session over to the truck on the route (TRK-01).
INSERT INTO truck_sessions (truck_id, sim_status, started_at, paused_at, stopped_at, paused_ms, active_run_id)
  SELECT t.id, s.status, s.started_at, s.paused_at, s.stopped_at, s.paused_ms,
         NULLIF((SELECT value FROM meta WHERE key = 'active_run_id'), '')
  FROM simulation_state s
  JOIN trucks t ON t.route_id IS NOT NULL
  WHERE s.id = 1
  ORDER BY t.rowid
  LIMIT 1;

-- A run can be the active run of only one truck.
CREATE UNIQUE INDEX truck_sessions_one_run ON truck_sessions (active_run_id) WHERE active_run_id IS NOT NULL;

-- 2. A route belongs to at most one truck.
CREATE UNIQUE INDEX trucks_one_route ON trucks (route_id) WHERE route_id IS NOT NULL;

-- 3. Which truck a GPS point, driver problem or notification belongs to.
ALTER TABLE location_history ADD COLUMN truck_id TEXT;
ALTER TABLE driver_issues    ADD COLUMN truck_id TEXT;
ALTER TABLE notifications    ADD COLUMN truck_id TEXT;   -- NULL = not about one truck

-- Every existing GPS point and driver problem came from the one route truck.
UPDATE location_history SET truck_id = (SELECT id FROM trucks WHERE route_id IS NOT NULL ORDER BY rowid LIMIT 1) WHERE truck_id IS NULL;
UPDATE driver_issues    SET truck_id = (SELECT id FROM trucks WHERE route_id IS NOT NULL ORDER BY rowid LIMIT 1) WHERE truck_id IS NULL;

CREATE INDEX location_history_truck ON location_history (truck_id, id);
