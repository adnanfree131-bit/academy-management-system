-- =============================================================================
-- APEX ACADEMY MANAGEMENT SYSTEM - MIGRATION 00024: DROP LEGACY SNAPSHOT TABLES
-- Remove legacy in-memory snapshot tables and compatibility backups.
-- PostgreSQL is the exclusive production application data store.
-- =============================================================================

DROP TABLE IF EXISTS public.kampus_store_snapshot_history CASCADE;
DROP TABLE IF EXISTS public.kampus_store_backups CASCADE;
DROP TABLE IF EXISTS public.kampus_store_snapshot CASCADE;
