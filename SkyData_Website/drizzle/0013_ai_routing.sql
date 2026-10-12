CREATE TABLE IF NOT EXISTS ai_router_settings (id TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ai_provider_catalog (provider TEXT PRIMARY KEY, checked INTEGER NOT NULL, status TEXT NOT NULL, models TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ai_router_usage (id TEXT PRIMARY KEY, day TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL, task TEXT NOT NULL, status INTEGER NOT NULL, latency INTEGER NOT NULL, input_tokens INTEGER, output_tokens INTEGER);
CREATE INDEX IF NOT EXISTS ai_router_usage_day ON ai_router_usage(day);
CREATE TABLE IF NOT EXISTS ai_router_budget (day TEXT PRIMARY KEY, count INTEGER NOT NULL);
