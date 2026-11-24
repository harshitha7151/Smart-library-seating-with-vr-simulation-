CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS library_floors (
  floor_number smallint PRIMARY KEY,
  label text NOT NULL,
  layout jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS library_tables (
  id text PRIMARY KEY,
  floor_number smallint NOT NULL REFERENCES library_floors(floor_number),
  label text NOT NULL,
  seat_count smallint NOT NULL CHECK (seat_count > 0),
  position jsonb NOT NULL,
  dimensions jsonb NOT NULL,
  outdoor boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS seats (
  id text PRIMARY KEY,
  table_id text NOT NULL REFERENCES library_tables(id),
  seat_number smallint NOT NULL CHECK (seat_number > 0),
  position jsonb NOT NULL,
  UNIQUE (table_id, seat_number)
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_id text NOT NULL REFERENCES seats(id),
  user_id uuid NOT NULL REFERENCES users(id),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CHECK (end_at > start_at),
  CONSTRAINT booking_no_overlap EXCLUDE USING gist (
    seat_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (status = 'confirmed')
);

CREATE TABLE IF NOT EXISTS seat_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_id text NOT NULL REFERENCES seats(id),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  CONSTRAINT maintenance_no_overlap EXCLUDE USING gist (
    seat_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
);

CREATE INDEX IF NOT EXISTS bookings_user_start_idx ON bookings(user_id, start_at DESC);
CREATE INDEX IF NOT EXISTS bookings_seat_start_idx ON bookings(seat_id, start_at);
CREATE INDEX IF NOT EXISTS maintenance_seat_start_idx ON seat_maintenance(seat_id, start_at);
CREATE INDEX IF NOT EXISTS seats_table_idx ON seats(table_id);
