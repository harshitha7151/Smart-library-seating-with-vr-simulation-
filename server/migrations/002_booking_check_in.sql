-- Add student check-in lifecycle data without deleting or recreating bookings.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS check_in_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_out_at timestamptz;

-- Preserve existing reservation rows and give them the configured default grace period.
UPDATE bookings
SET check_in_deadline = start_at + interval '10 minutes'
WHERE check_in_deadline IS NULL;

ALTER TABLE bookings
  ALTER COLUMN check_in_deadline SET NOT NULL;

CREATE INDEX IF NOT EXISTS bookings_check_in_expiry_idx
  ON bookings (check_in_deadline)
  WHERE status = 'confirmed' AND checked_in_at IS NULL;

CREATE INDEX IF NOT EXISTS bookings_active_end_idx
  ON bookings (end_at)
  WHERE status = 'confirmed';
