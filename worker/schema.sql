-- worker/schema.sql —— Cloudflare D1 初始化
CREATE TABLE IF NOT EXISTS stats (
    key TEXT PRIMARY KEY,
    views INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rate_limits (
    ip_hash TEXT NOT NULL,
    day TEXT NOT NULL,
    bucket TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (ip_hash, day, bucket)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_day ON rate_limits(day);
