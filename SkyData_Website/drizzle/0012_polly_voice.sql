CREATE TABLE IF NOT EXISTS polly_settings (id TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS polly_months (month TEXT PRIMARY KEY, characters INTEGER NOT NULL DEFAULT 0, requests INTEGER NOT NULL DEFAULT 0, estimated_cost REAL NOT NULL DEFAULT 0, unpriced_characters INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS polly_activity (id TEXT PRIMARY KEY, created INTEGER NOT NULL, engine TEXT NOT NULL, voice TEXT NOT NULL, characters INTEGER NOT NULL, estimated_cost REAL, status TEXT NOT NULL, code TEXT);
CREATE INDEX IF NOT EXISTS polly_activity_created ON polly_activity(created);
CREATE TABLE IF NOT EXISTS polly_leases (id TEXT PRIMARY KEY, expires INTEGER NOT NULL);
