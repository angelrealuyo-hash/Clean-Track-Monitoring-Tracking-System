-- Truck crew members (collectors, helpers, etc.). They do not sign in, so they
-- are kept apart from drivers (who have accounts) and residents.
CREATE TABLE crew_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT,                          -- optional work contact
  truck_id TEXT,                       -- assigned truck (NULL = unassigned)
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL
);
