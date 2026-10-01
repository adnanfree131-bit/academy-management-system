-- Compatibility persistence used by the current Fastify store.
-- Browser-facing Supabase roles must never read this all-tenant payload.
CREATE TABLE IF NOT EXISTS kampus_store_snapshot (
  id INTEGER PRIMARY KEY,
  payload JSONB NOT NULL,
  academy_count INTEGER,
  version BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kampus_store_snapshot_history (
  id BIGSERIAL PRIMARY KEY,
  payload JSONB NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kampus_store_backups (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  academy_count INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kampus_store_backups_kind_created
  ON kampus_store_backups (kind, created_at DESC);

REVOKE ALL ON kampus_store_snapshot, kampus_store_snapshot_history, kampus_store_backups FROM PUBLIC;
REVOKE ALL ON kampus_store_snapshot, kampus_store_snapshot_history, kampus_store_backups FROM authenticated;
REVOKE ALL ON SEQUENCE kampus_store_snapshot_history_id_seq, kampus_store_backups_id_seq FROM PUBLIC;
REVOKE ALL ON SEQUENCE kampus_store_snapshot_history_id_seq, kampus_store_backups_id_seq FROM authenticated;
