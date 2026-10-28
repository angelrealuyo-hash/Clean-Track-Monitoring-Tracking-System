-- The apps no longer show a barangay name by default.
-- Clears ONLY the old demo values; a name an admin typed in Settings is kept.
UPDATE settings SET value_json = '""' WHERE key = 'barangayName' AND value_json = '"Barangay Rizal"';
UPDATE routes SET name = 'Barangay Collection Route (demo)' WHERE name = 'Barangay Rizal Collection Route (demo)';
