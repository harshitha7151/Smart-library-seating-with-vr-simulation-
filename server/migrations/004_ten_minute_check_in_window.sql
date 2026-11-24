-- Move existing default grace windows from 15 to 10 minutes. Custom deadlines
-- and bookings that have already checked in are left unchanged.
BEGIN;
UPDATE public.bookings
SET check_in_deadline = start_at + interval '10 minutes'
WHERE checked_in_at IS NULL
  AND check_in_deadline = start_at + interval '15 minutes';
COMMIT;
