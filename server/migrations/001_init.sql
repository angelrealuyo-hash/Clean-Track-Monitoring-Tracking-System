-- CleanTrack database schema (SQLite). Applied once by server/db.js.
-- One barangay, one truck. All coordinates in route_stops are DEMO data until verified.

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Sign-in accounts (admin, drivers, residents). Passwords are scrypt hashes.
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'driver', 'resident')),
  ref_id TEXT NOT NULL,              -- driver id / resident id / 'ADMIN'
  email TEXT COLLATE NOCASE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX accounts_email ON accounts (role, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX accounts_phone ON accounts (role, phone) WHERE phone IS NOT NULL;

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);

CREATE TABLE trucks (
  id TEXT PRIMARY KEY,
  plate_number TEXT NOT NULL,
  type TEXT NOT NULL,
  model TEXT,
  capacity_tons REAL,
  fuel TEXT,
  odometer_km INTEGER,
  driver_id TEXT,
  route_id TEXT,
  status TEXT NOT NULL,
  next_service_date TEXT
);

CREATE TABLE maintenance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  truck_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  odometer_km INTEGER,
  notes TEXT
);

CREATE TABLE drivers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  initials TEXT,
  phone TEXT,
  email TEXT,
  license TEXT,
  shift TEXT,
  status TEXT NOT NULL
);

CREATE TABLE routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  start_time TEXT,
  coordinates_verified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE route_stops (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  name TEXT NOT NULL,
  purok TEXT NOT NULL,
  households INTEGER NOT NULL DEFAULT 0,
  lat REAL NOT NULL,
  lng REAL NOT NULL
);

CREATE TABLE schedules (
  day TEXT PRIMARY KEY,
  seq INTEGER NOT NULL,
  waste_type TEXT NOT NULL,
  time_window TEXT NOT NULL
);

CREATE TABLE collection_runs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  started_by TEXT NOT NULL,
  truck_id TEXT,
  driver_id TEXT,
  driver_name TEXT,
  route_id TEXT,
  route_name TEXT,
  stops_json TEXT NOT NULL           -- snapshot of pickup points when the run started
);

CREATE TABLE collection_records (
  run_id TEXT NOT NULL,
  stop_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('collected', 'missed')),
  note TEXT,
  recorded_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL,         -- 'driver' | 'admin'
  recorded_by_name TEXT,
  bags INTEGER,
  sim_at INTEGER,                    -- simulated truck clock (ms) when recorded
  PRIMARY KEY (run_id, stop_id)
);

CREATE TABLE residents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  initials TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  purok TEXT,
  household_id TEXT,
  prefs_json TEXT NOT NULL,
  created_at TEXT
);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL,
  resident_name TEXT,
  resident_phone TEXT,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  photo TEXT,
  sms_updates INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  admin_response TEXT
);

CREATE TABLE report_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  at TEXT NOT NULL,
  text TEXT NOT NULL
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  audience TEXT NOT NULL,
  priority TEXT,
  title TEXT NOT NULL,
  body TEXT,
  time TEXT NOT NULL,
  zone TEXT,
  kind TEXT,
  key TEXT UNIQUE,                   -- de-duplication key for automatic messages
  resident_id TEXT,
  link_json TEXT,
  photo TEXT
);

CREATE TABLE notification_reads (
  notification_id TEXT NOT NULL,
  user_key TEXT NOT NULL,
  PRIMARY KEY (notification_id, user_key)
);

CREATE TABLE broadcasts (
  id TEXT PRIMARY KEY,
  zone TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT,
  channels_json TEXT NOT NULL,
  sent_at TEXT NOT NULL
);

CREATE TABLE simulation_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL,
  started_at TEXT,
  paused_at TEXT,
  stopped_at TEXT,
  paused_ms INTEGER NOT NULL DEFAULT 0
);

-- Every email attempt, with the provider's answer. event_key prevents duplicates.
CREATE TABLE email_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_key TEXT NOT NULL UNIQUE,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'not_configured')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  provider_response TEXT,
  related_type TEXT,
  related_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  next_attempt_at TEXT
);

-- Simulated truck positions (source is always SIMULATED until a GPS device exists).
CREATE TABLE location_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_at TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  status TEXT,
  source TEXT NOT NULL DEFAULT 'SIMULATED',
  run_id TEXT,
  event TEXT
);
