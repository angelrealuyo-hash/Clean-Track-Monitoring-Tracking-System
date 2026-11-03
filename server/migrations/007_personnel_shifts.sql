-- Truck 1 personnel shifts and limits (see src/data/personnel.js).
-- Each shift has at most 1 active Driver and 3 active Crew Members (8 people in all).
-- Inactive people keep their record and shift but do NOT take a slot.
-- No record or picture is deleted by this migration.

-- 1. New fields.
ALTER TABLE drivers ADD COLUMN truck_id TEXT;              -- truck roster (NULL = not on the roster)
ALTER TABLE drivers ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE crew_members ADD COLUMN shift TEXT;            -- 'morning' | 'afternoon' | NULL

-- 2. Drivers: the old free-text shift becomes 'morning' / 'afternoon'.
--    "Relief Driver" (or anything else) becomes "not on a shift".
UPDATE drivers SET shift = CASE
  WHEN shift LIKE 'Morning%' THEN 'morning'
  WHEN shift LIKE 'Afternoon%' THEN 'afternoon'
  ELSE NULL END;

-- The driver currently assigned to the truck keeps a place on it: if they had
-- no shift, they get Morning if it has no driver, otherwise Afternoon.
UPDATE drivers SET shift = 'morning'
  WHERE shift IS NULL AND id IN (SELECT driver_id FROM trucks WHERE driver_id IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM drivers o WHERE o.shift = 'morning');
UPDATE drivers SET shift = 'afternoon'
  WHERE shift IS NULL AND id IN (SELECT driver_id FROM trucks WHERE driver_id IS NOT NULL);

-- Only one driver per shift: the truck's current driver wins, then the lowest id.
-- The others stay saved but are taken off the roster.
UPDATE drivers SET shift = NULL
  WHERE shift IS NOT NULL AND EXISTS (
    SELECT 1 FROM drivers e
    WHERE e.shift = drivers.shift AND e.id <> drivers.id
      AND (
        COALESCE((SELECT 1 FROM trucks t WHERE t.driver_id = e.id), 0) > COALESCE((SELECT 1 FROM trucks t WHERE t.driver_id = drivers.id), 0)
        OR (COALESCE((SELECT 1 FROM trucks t WHERE t.driver_id = e.id), 0) = COALESCE((SELECT 1 FROM trucks t WHERE t.driver_id = drivers.id), 0) AND e.id < drivers.id)
      )
  );
UPDATE drivers SET truck_id = (SELECT id FROM trucks LIMIT 1) WHERE shift IS NOT NULL;

-- The truck's "driver on duty" must be on its roster.
UPDATE trucks SET driver_id = NULL
  WHERE driver_id IS NOT NULL AND driver_id NOT IN (SELECT id FROM drivers WHERE truck_id IS NOT NULL);

-- 3. Crew: active crew on the truck fill Morning first, then Afternoon (oldest
--    first). Anyone over the 6 places is taken off the truck (record kept).
--    Inactive crew on the truck are listed under Morning (no slot used).
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS n
  FROM crew_members WHERE truck_id IS NOT NULL AND status = 'active'
)
UPDATE crew_members SET shift = CASE
    WHEN (SELECT n FROM ranked WHERE ranked.id = crew_members.id) <= 3 THEN 'morning'
    WHEN (SELECT n FROM ranked WHERE ranked.id = crew_members.id) <= 6 THEN 'afternoon'
    ELSE NULL END
  WHERE id IN (SELECT id FROM ranked);
UPDATE crew_members SET shift = 'morning' WHERE truck_id IS NOT NULL AND status = 'inactive';
UPDATE crew_members SET truck_id = NULL WHERE shift IS NULL;

-- 4. Database safeguards (last line of defence behind server/policy.js).
-- Shift values.
CREATE TRIGGER drivers_shift_valid_ins BEFORE INSERT ON drivers
  WHEN NEW.shift IS NOT NULL AND NEW.shift NOT IN ('morning', 'afternoon')
  BEGIN SELECT RAISE(ABORT, 'PERSONNEL_INVALID_SHIFT'); END;
CREATE TRIGGER drivers_shift_valid_upd BEFORE UPDATE OF shift ON drivers
  WHEN NEW.shift IS NOT NULL AND NEW.shift NOT IN ('morning', 'afternoon')
  BEGIN SELECT RAISE(ABORT, 'PERSONNEL_INVALID_SHIFT'); END;
CREATE TRIGGER crew_shift_valid_ins BEFORE INSERT ON crew_members
  WHEN NEW.shift IS NOT NULL AND NEW.shift NOT IN ('morning', 'afternoon')
  BEGIN SELECT RAISE(ABORT, 'PERSONNEL_INVALID_SHIFT'); END;
CREATE TRIGGER crew_shift_valid_upd BEFORE UPDATE OF shift ON crew_members
  WHEN NEW.shift IS NOT NULL AND NEW.shift NOT IN ('morning', 'afternoon')
  BEGIN SELECT RAISE(ABORT, 'PERSONNEL_INVALID_SHIFT'); END;

-- 1 active driver per truck shift.
CREATE UNIQUE INDEX drivers_one_per_shift ON drivers (truck_id, shift)
  WHERE active = 1 AND truck_id IS NOT NULL AND shift IS NOT NULL;

-- 3 active crew members per truck shift.
CREATE TRIGGER crew_shift_limit_ins BEFORE INSERT ON crew_members
  WHEN NEW.status = 'active' AND NEW.truck_id IS NOT NULL AND NEW.shift IS NOT NULL
  BEGIN
    SELECT RAISE(ABORT, 'PERSONNEL_SHIFT_FULL')
    WHERE (SELECT COUNT(*) FROM crew_members WHERE truck_id = NEW.truck_id AND shift = NEW.shift AND status = 'active') >= 3;
  END;
CREATE TRIGGER crew_shift_limit_upd BEFORE UPDATE OF status, truck_id, shift ON crew_members
  WHEN NEW.status = 'active' AND NEW.truck_id IS NOT NULL AND NEW.shift IS NOT NULL
  BEGIN
    SELECT RAISE(ABORT, 'PERSONNEL_SHIFT_FULL')
    WHERE (SELECT COUNT(*) FROM crew_members WHERE truck_id = NEW.truck_id AND shift = NEW.shift AND status = 'active' AND id <> NEW.id) >= 3;
  END;
