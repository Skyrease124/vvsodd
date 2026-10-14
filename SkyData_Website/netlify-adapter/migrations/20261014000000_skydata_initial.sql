-- SkyData schema for Netlify Database (Postgres), translated from the SQLite (D1) migrations in ../drizzle
-- and the tables the code creates at run time. SQLite INTEGER holds millisecond timestamps, so every
-- integer column is BIGINT; REAL is DOUBLE PRECISION; BLOB is BYTEA. "window" is reserved in Postgres.

CREATE TABLE IF NOT EXISTS secrets (name TEXT PRIMARY KEY, ciphertext TEXT NOT NULL, iv TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS chat_state (owner TEXT PRIMARY KEY, state TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS request_limits (id TEXT PRIMARY KEY, "window" BIGINT NOT NULL, count BIGINT NOT NULL);

CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, size BIGINT NOT NULL, status TEXT NOT NULL, upload TEXT NOT NULL, key TEXT NOT NULL, chunks BIGINT NOT NULL, created BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS project_parts (id TEXT PRIMARY KEY, project TEXT NOT NULL, number BIGINT NOT NULL, etag TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS site_admin (id TEXT PRIMARY KEY, owner TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS members (email TEXT PRIMARY KEY, user_id TEXT, status TEXT NOT NULL, password_hash TEXT, password_salt TEXT, created BIGINT NOT NULL, last_seen BIGINT, daily_limit BIGINT NOT NULL DEFAULT 100, usage_paused BIGINT NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX IF NOT EXISTS members_user_id_unique ON members (user_id);
CREATE TABLE IF NOT EXISTS member_sessions (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS daily_allowance (id TEXT PRIMARY KEY, email TEXT NOT NULL, day TEXT NOT NULL, used BIGINT NOT NULL);

CREATE TABLE IF NOT EXISTS blender_device (owner TEXT PRIMARY KEY, id TEXT NOT NULL UNIQUE, token_hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created BIGINT NOT NULL, last_seen BIGINT, blender_ready BIGINT NOT NULL DEFAULT 0, protocol_version BIGINT NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS blender_pairing (owner TEXT PRIMARY KEY, code_hash TEXT NOT NULL UNIQUE, expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS blender_scene_request (owner TEXT PRIMARY KEY, id TEXT NOT NULL UNIQUE, device_id TEXT NOT NULL, created BIGINT NOT NULL, expires BIGINT NOT NULL, status TEXT NOT NULL, completed BIGINT, snapshot TEXT);
CREATE TABLE IF NOT EXISTS blender_command (owner TEXT PRIMARY KEY, id TEXT NOT NULL UNIQUE, device_id TEXT NOT NULL, created BIGINT NOT NULL, expires BIGINT NOT NULL, status TEXT NOT NULL, prompt TEXT NOT NULL, plan TEXT, completed BIGINT, message TEXT);

CREATE TABLE IF NOT EXISTS knowledge_documents (id TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, size BIGINT NOT NULL, kind TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL, key TEXT NOT NULL, upload TEXT NOT NULL, next_batch BIGINT NOT NULL DEFAULT 0, units BIGINT NOT NULL DEFAULT 0, chunks BIGINT NOT NULL DEFAULT 0, indexed BIGINT NOT NULL DEFAULT 0, empty_units BIGINT NOT NULL DEFAULT 0, error TEXT, enabled BIGINT NOT NULL DEFAULT 1, review TEXT NOT NULL DEFAULT 'unreviewed', created BIGINT NOT NULL, updated BIGINT NOT NULL, lease TEXT, lease_until BIGINT NOT NULL DEFAULT 0, attempts BIGINT NOT NULL DEFAULT 0, retry_at BIGINT NOT NULL DEFAULT 0, metadata TEXT NOT NULL DEFAULT '{}');
CREATE INDEX IF NOT EXISTS knowledge_documents_owner_status ON knowledge_documents (owner, status);
CREATE TABLE IF NOT EXISTS knowledge_parts (id TEXT PRIMARY KEY, document TEXT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE, number BIGINT NOT NULL, etag TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS knowledge_batches (id TEXT PRIMARY KEY, document TEXT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE, number BIGINT NOT NULL, hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS knowledge_chunks (id TEXT PRIMARY KEY, document TEXT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE, owner TEXT NOT NULL, ordinal BIGINT NOT NULL, page BIGINT, page_index BIGINT, page_end BIGINT, page_label TEXT, printed_page TEXT, location_status TEXT NOT NULL DEFAULT 'legacy', section TEXT NOT NULL, content TEXT NOT NULL, hash TEXT NOT NULL, vector BYTEA, model TEXT, created BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS knowledge_chunks_document_ordinal ON knowledge_chunks (document, ordinal);
CREATE INDEX IF NOT EXISTS knowledge_chunks_owner ON knowledge_chunks (owner);
CREATE TABLE IF NOT EXISTS knowledge_buckets (id TEXT PRIMARY KEY, owner TEXT NOT NULL, bucket TEXT NOT NULL, chunk TEXT NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS knowledge_buckets_lookup ON knowledge_buckets (owner, bucket);
CREATE TABLE IF NOT EXISTS knowledge_terms (id TEXT PRIMARY KEY, owner TEXT NOT NULL, term TEXT NOT NULL, chunk TEXT NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS knowledge_terms_lookup ON knowledge_terms (owner, term);

CREATE TABLE IF NOT EXISTS polly_settings (id TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS polly_months (month TEXT PRIMARY KEY, characters BIGINT NOT NULL DEFAULT 0, requests BIGINT NOT NULL DEFAULT 0, estimated_cost DOUBLE PRECISION NOT NULL DEFAULT 0, unpriced_characters BIGINT NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS polly_activity (id TEXT PRIMARY KEY, created BIGINT NOT NULL, engine TEXT NOT NULL, voice TEXT NOT NULL, characters BIGINT NOT NULL, estimated_cost DOUBLE PRECISION, status TEXT NOT NULL, code TEXT);
CREATE INDEX IF NOT EXISTS polly_activity_created ON polly_activity (created);
CREATE TABLE IF NOT EXISTS polly_leases (id TEXT PRIMARY KEY, expires BIGINT NOT NULL);

CREATE TABLE IF NOT EXISTS ai_router_settings (id TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ai_provider_catalog (provider TEXT PRIMARY KEY, checked BIGINT NOT NULL, status TEXT NOT NULL, models TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ai_router_usage (id TEXT PRIMARY KEY, day TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL, task TEXT NOT NULL, status BIGINT NOT NULL, latency BIGINT NOT NULL, input_tokens BIGINT, output_tokens BIGINT);
CREATE INDEX IF NOT EXISTS ai_router_usage_day ON ai_router_usage (day);
CREATE TABLE IF NOT EXISTS ai_router_budget (day TEXT PRIMARY KEY, count BIGINT NOT NULL);

-- Created by the code at run time on Cloudflare; created here too so the first request doesn't have to.
CREATE TABLE IF NOT EXISTS engineering_runner_pair (owner TEXT PRIMARY KEY, code_hash TEXT UNIQUE NOT NULL, expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS engineering_runner_device (owner TEXT PRIMARY KEY, id TEXT UNIQUE NOT NULL, token_hash TEXT UNIQUE NOT NULL, expires BIGINT NOT NULL, last_seen BIGINT NOT NULL, ready BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS engineering_runner_job (owner TEXT PRIMARY KEY, id TEXT UNIQUE NOT NULL, device TEXT NOT NULL, code TEXT NOT NULL, status TEXT NOT NULL, created BIGINT NOT NULL, expires BIGINT NOT NULL, result TEXT);
CREATE TABLE IF NOT EXISTS engineering_runner_history (id TEXT PRIMARY KEY, owner TEXT NOT NULL, created BIGINT NOT NULL, kind TEXT NOT NULL, project_id TEXT, project_name TEXT, proposal_id TEXT, entry TEXT, files TEXT NOT NULL, payload_sha256 TEXT NOT NULL, status TEXT NOT NULL, phase TEXT, phase_at BIGINT, claimed BIGINT, completed BIGINT, result TEXT);
CREATE INDEX IF NOT EXISTS engineering_runner_history_owner ON engineering_runner_history (owner, created);
CREATE TABLE IF NOT EXISTS engineering_runner_rea (owner TEXT PRIMARY KEY, available BIGINT NOT NULL, rea_version TEXT, adapter_version TEXT, image_id TEXT, detail TEXT, checked BIGINT, updated BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS engineering_runner_health (owner TEXT PRIMARY KEY, version TEXT, docker_ok BIGINT, docker_checked BIGINT, docker_detail TEXT, updated BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS engineering_browser_jobs (id TEXT PRIMARY KEY, owner TEXT NOT NULL, url TEXT NOT NULL, goal TEXT NOT NULL, engine TEXT NOT NULL, model TEXT NOT NULL, workflow TEXT NOT NULL, created TEXT NOT NULL, status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS engineering_browser_hp (id TEXT PRIMARY KEY, owner TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS engineering_runner_browser (owner TEXT PRIMARY KEY, available BIGINT NOT NULL, stagehand_version TEXT, adapter_version TEXT, rea BIGINT NOT NULL, detail TEXT, checked BIGINT, updated BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS engineering_browser_relay (id TEXT PRIMARY KEY, owner TEXT NOT NULL, token_hash TEXT NOT NULL, expires BIGINT NOT NULL, calls BIGINT NOT NULL DEFAULT 0, input_tokens BIGINT NOT NULL DEFAULT 0, output_tokens BIGINT NOT NULL DEFAULT 0);
