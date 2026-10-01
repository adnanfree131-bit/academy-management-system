-- =============================================================================
-- MIGRATION 00015: BATCH SHIFTS, TIMINGS, AND REMOVE ROOM NUMBER
-- Adds start_time, end_time, expands shift check constraint, drops room_number
-- =============================================================================

-- 1. Drop room_number from batches if it exists
ALTER TABLE batches DROP COLUMN IF EXISTS room_number;

-- 2. Drop existing shift check constraint if present and re-add with afternoon and weekend
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_shift_check;
ALTER TABLE batches ADD CONSTRAINT batches_shift_check CHECK (shift IN ('morning', 'afternoon', 'evening', 'weekend'));

-- 3. Add shift start and end times
ALTER TABLE batches ADD COLUMN IF NOT EXISTS start_time VARCHAR(20);
ALTER TABLE batches ADD COLUMN IF NOT EXISTS end_time VARCHAR(20);
