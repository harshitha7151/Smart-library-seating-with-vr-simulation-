-- Read-oriented analysis objects. These never participate in booking decisions.
-- The materialized view is refreshed explicitly and may be stale between refreshes.
CREATE OR REPLACE VIEW seat_availability_current AS
SELECT s.id AS seat_id,
       t.id AS table_id,
       t.floor_number,
       CASE
         WHEN EXISTS (
           SELECT 1 FROM bookings b
           WHERE b.seat_id = s.id AND b.status = 'confirmed'
             AND b.checked_in_at IS NOT NULL AND b.start_at <= now() AND b.end_at > now()
         ) THEN 'occupied'
         WHEN EXISTS (
           SELECT 1 FROM bookings b
           WHERE b.seat_id = s.id AND b.status = 'confirmed'
             AND b.start_at <= now() AND b.end_at > now()
         ) THEN 'booked'
         WHEN EXISTS (
           SELECT 1 FROM seat_maintenance m
           WHERE m.seat_id = s.id AND m.start_at <= now() AND m.end_at > now()
         ) THEN 'unavailable'
         ELSE 'available'
       END AS status
FROM seats s
JOIN library_tables t ON t.id = s.table_id;

CREATE OR REPLACE VIEW table_availability_current AS
SELECT table_id,
       floor_number,
       count(*)::integer AS total_seats,
       count(*) FILTER (WHERE status = 'available')::integer AS available_seats,
       count(*) FILTER (WHERE status IN ('booked', 'occupied'))::integer AS reserved_seats,
       count(*) FILTER (WHERE status = 'unavailable')::integer AS unavailable_seats
FROM seat_availability_current
GROUP BY table_id, floor_number;

CREATE MATERIALIZED VIEW IF NOT EXISTS seat_usage_daily AS
SELECT (b.start_at AT TIME ZONE 'UTC')::date AS reservation_date,
       s.table_id,
       count(*)::bigint AS reservation_count,
       count(*) FILTER (WHERE b.status = 'cancelled')::bigint AS cancelled_count,
       count(*) FILTER (WHERE b.status = 'completed')::bigint AS completed_count
FROM bookings b
JOIN seats s ON s.id = b.seat_id
JOIN library_tables t ON t.id = s.table_id
WHERE t.floor_number = 3
GROUP BY (b.start_at AT TIME ZONE 'UTC')::date, s.table_id;

CREATE UNIQUE INDEX IF NOT EXISTS seat_usage_daily_date_table_uidx
  ON seat_usage_daily (reservation_date, table_id);
