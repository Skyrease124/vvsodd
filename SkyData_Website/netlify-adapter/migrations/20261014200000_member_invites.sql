-- One-time invite links (lib/member-invites.ts): one active link per approved email, stored only as a SHA-256.
CREATE TABLE IF NOT EXISTS member_invites (email TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, created BIGINT NOT NULL, expires BIGINT NOT NULL);
