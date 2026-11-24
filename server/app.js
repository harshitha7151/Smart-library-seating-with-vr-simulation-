import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import pool, { withTransaction } from "./db.js";
import { mongoHealth, writeActivity } from "./events.js";
import { bookingSchema, bookingWindowError, loginRequestSchema, rvceEmailSchema, usnSchema } from "./validation.js";
import { checkInDecision, configuredCheckInGrace } from "./lifecycle.js";

const app = express();
const sessionCookie = "seatspace_session";
const configuredClientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const allowedOrigins = new Set([configuredClientOrigin]);
if (process.env.NODE_ENV !== "production") {
  for (const port of [5173, 5180, 5181, 5182]) {
    allowedOrigins.add(`http://localhost:${port}`);
    allowedOrigins.add(`http://127.0.0.1:${port}`);
  }
}
const cookieOptions = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: "lax",
  path: "/",
  maxAge: 1000 * 60 * 60 * 8,
};

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("This application origin is not allowed."));
  },
  credentials: true,
}));
app.use(express.json({ limit: "64kb" }));
app.use(cookieParser());
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: "draft-8", legacyHeaders: false }));

const signupSchema = z.object({
  email: rvceEmailSchema,
  usn: usnSchema,
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(1).max(120),
});

async function audit(event) {
  try {
    await writeActivity(event);
    return true;
  } catch (error) {
    console.error("MongoDB audit event was not stored:", error.message);
    return false;
  }
}

async function requireUser(req, res, next) {
  const token = req.cookies[sessionCookie];
  if (!token) return res.status(401).json({ error: "Sign in to continue." });
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.clearCookie(sessionCookie, { httpOnly: true, secure: cookieOptions.secure, sameSite: "lax", path: "/" });
    return res.status(401).json({ error: "Your sign-in has expired. Please sign in again." });
  }
  const result = await pool.query(
    `SELECT id, email, display_name AS "displayName" FROM users WHERE id = $1`,
    [payload.sub],
  );
  if (!result.rowCount) return res.status(401).json({ error: "This account is no longer available." });
  req.user = { ...result.rows[0], isAdmin: isAdministrator(result.rows[0].email) };
  return next();
}

function checkInGraceMinutes() {
  return configuredCheckInGrace(process.env.CHECK_IN_GRACE_MINUTES);
}

function isAdministrator(email) {
  const configured = (process.env.ADMIN_EMAILS || "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  return configured.includes(String(email || "").toLowerCase());
}

function requireAdministrator(req, res, next) {
  if (!isAdministrator(req.user?.email)) {
    return res.status(403).json({ error: "This account is not configured for SeatSpace administration." });
  }
  return next();
}

export async function expireBookings() {
  const result = await pool.query(
    `UPDATE bookings
     SET status = CASE WHEN checked_in_at IS NULL THEN 'no_show' ELSE 'completed' END,
         checked_out_at = CASE WHEN checked_in_at IS NULL THEN checked_out_at ELSE COALESCE(checked_out_at, end_at) END
     WHERE status = 'confirmed'
       AND ((checked_in_at IS NULL AND check_in_deadline <= now())
         OR (checked_in_at IS NOT NULL AND end_at <= now()))
     RETURNING id, user_id, seat_id, status`,
  );
  for (const booking of result.rows) {
    await audit({ action: booking.status === "no_show" ? "booking.no_show" : "booking.completed", actorId: booking.user_id, entityType: "booking", entityId: booking.id, metadata: { seatId: booking.seat_id } });
  }
  return result.rowCount;
}

function parseRange(query) {
  const startAt = query.startAt ? new Date(query.startAt) : new Date();
  const endAt = query.endAt ? new Date(query.endAt) : new Date(startAt.getTime() + 60_000);
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || endAt <= startAt) {
    return null;
  }
  if (endAt.getTime() - startAt.getTime() > 4 * 60 * 60 * 1000) return null;
  return { startAt, endAt };
}

app.get("/api/health", async (_req, res) => {
  const status = { api: "ok", postgres: "ok", mongodb: "unknown" };
  try { await pool.query("SELECT 1"); } catch { status.postgres = "unavailable"; }
  try { await mongoHealth(); status.mongodb = "ok"; } catch { status.mongodb = "unavailable"; }
  // MongoDB is an optional audit store; only PostgreSQL is required for health
  const ok = status.postgres === "ok";
  res.status(ok ? 200 : 503).json(status);
});

app.post("/api/auth/register", async (req, res) => {
  const input = signupSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(input.password, 12);
  try {
    const result = await pool.query(
      `INSERT INTO users (email, usn, display_name, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name AS "displayName"`,
      [input.email, input.usn, input.displayName, passwordHash],
    );
    await audit({ action: "account.registered", actorId: result.rows[0].id, entityType: "user", entityId: result.rows[0].id });
    res.status(201).json({ user: { ...result.rows[0], isAdmin: isAdministrator(result.rows[0].email) }, message: "Your SeatSpace account is ready. You can now reserve a seat." });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "An account already exists for that email or USN." });
    throw error;
  }
});

app.post("/api/auth/login", async (req, res) => {
  const input = loginRequestSchema.parse(req.body);
  const result = await pool.query(
    `SELECT id, email, display_name AS "displayName", password_hash FROM users
     WHERE email = $1 OR usn = $2`,
    [input.loginId.includes("@") ? input.loginId : "", input.loginId.includes("@") ? "" : input.loginId],
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "8h", issuer: "seatspace" });
  res.cookie(sessionCookie, token, cookieOptions);
  delete user.password_hash;
  user.isAdmin = isAdministrator(user.email);
  const auditStored = await audit({ action: "auth.login", actorId: user.id, entityType: "user", entityId: user.id });
  res.json({ user, auditStored });
});

app.post("/api/auth/logout", async (req, res) => {
  const userId = (() => { try { return jwt.verify(req.cookies[sessionCookie], process.env.JWT_SECRET).sub; } catch { return null; } })();
  res.clearCookie(sessionCookie, cookieOptions);
  if (userId) await audit({ action: "auth.logout", actorId: userId, entityType: "user", entityId: userId });
  res.status(204).end();
});

app.get("/api/auth/me", requireUser, (req, res) => res.json({ user: req.user }));

app.patch("/api/profile", requireUser, async (req, res) => {
  const input = z.object({ displayName: z.string().trim().min(1).max(120) }).parse(req.body);
  const result = await pool.query(
    `UPDATE users SET display_name = $1, updated_at = now()
     WHERE id = $2 RETURNING id, email, display_name AS "displayName"`,
    [input.displayName, req.user.id],
  );
  await audit({ action: "profile.updated", actorId: req.user.id, entityType: "user", entityId: req.user.id });
  res.json({ user: { ...result.rows[0], isAdmin: isAdministrator(result.rows[0].email) } });
});

app.get("/api/floors/3/layout", async (_req, res) => {
  const result = await pool.query(
    `SELECT f.floor_number AS "floorNumber", f.label, f.layout,
            COALESCE(jsonb_agg(jsonb_build_object(
              'id', t.id, 'label', t.label, 'seatCount', t.seat_count,
              'position', t.position, 'dimensions', t.dimensions, 'outdoor', t.outdoor,
              'seats', (SELECT jsonb_agg(jsonb_build_object('id', s.id, 'number', s.seat_number, 'position', s.position) ORDER BY s.seat_number) FROM seats s WHERE s.table_id = t.id)
            ) ORDER BY t.id) FILTER (WHERE t.id IS NOT NULL), '[]'::jsonb) AS tables
     FROM library_floors f LEFT JOIN library_tables t ON t.floor_number = f.floor_number
     WHERE f.floor_number = 3 GROUP BY f.floor_number`,
  );
  if (!result.rowCount) return res.status(503).json({ error: "The third-floor layout has not been seeded. Run npm run db:seed." });
  res.json(result.rows[0]);
});

app.get("/api/admin/database/schema", requireUser, requireAdministrator, async (_req, res) => {
  const [tables, columns, constraints, indexes, views, routines, triggers, role, rls] = await Promise.all([
    pool.query(`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`),
    pool.query(`SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`),
    pool.query(`SELECT c.relname AS table_name, con.conname AS name,
      CASE con.contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'f' THEN 'FOREIGN KEY' WHEN 'u' THEN 'UNIQUE' WHEN 'c' THEN 'CHECK' WHEN 'x' THEN 'EXCLUSION' ELSE con.contype::text END AS type,
      pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' ORDER BY c.relname, con.conname`),
    pool.query(`SELECT tablename AS table_name, indexname AS name, indexdef AS definition FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname`),
    pool.query(`SELECT schemaname AS schema, matviewname AS name, ispopulated AS populated FROM pg_matviews WHERE schemaname = 'public'`),
    pool.query(`SELECT p.proname AS name, pg_get_function_identity_arguments(p.oid) AS arguments,
      l.lanname AS language, p.prosecdef AS security_definer FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
      WHERE n.nspname='public' AND p.prokind IN ('f','p') ORDER BY p.proname`),
    pool.query(`SELECT event_object_table AS table_name, trigger_name AS name, action_timing AS timing,
      event_manipulation AS event, action_statement AS definition FROM information_schema.triggers
      WHERE trigger_schema='public' ORDER BY event_object_table, trigger_name`),
    pool.query(`SELECT current_user AS name, rolsuper AS superuser, rolcreatedb AS can_create_database,
      rolcreaterole AS can_create_roles, rolinherit AS inherits FROM pg_roles WHERE rolname=current_user`),
    pool.query(`SELECT relname AS table_name, relrowsecurity AS row_level_security,
      relforcerowsecurity AS force_row_level_security FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' ORDER BY relname`),
  ]);
  res.json({ tables: tables.rows, columns: columns.rows, constraints: constraints.rows, indexes: indexes.rows,
    ordinaryViews: (await pool.query(`SELECT table_name AS name FROM information_schema.views WHERE table_schema = 'public' ORDER BY table_name`)).rows,
    materializedViews: views.rows, routines: routines.rows, triggers: triggers.rows, connectionRole: role.rows[0], rowLevelSecurity: rls.rows });
});

app.get("/api/admin/database/analytics", requireUser, requireAdministrator, async (_req, res) => {
  const [seats, daily, weekly, monthly, tables, zones, hours, totals, materialized] = await Promise.all([
    pool.query(`SELECT status, count(*)::integer AS count FROM seat_availability_current WHERE floor_number = 3 GROUP BY status ORDER BY status`),
    pool.query(`SELECT date_trunc('day', b.start_at)::date AS day, count(*)::integer AS reservations,
      count(*) FILTER (WHERE b.status = 'cancelled')::integer AS cancelled
      FROM bookings b JOIN seats s ON s.id = b.seat_id JOIN library_tables t ON t.id = s.table_id
      WHERE t.floor_number = 3 AND b.start_at >= now() - interval '30 days' GROUP BY day ORDER BY day`),
    pool.query(`SELECT date_trunc('week', b.start_at)::date AS week_start, count(*)::integer AS reservations
      FROM bookings b JOIN seats s ON s.id=b.seat_id JOIN library_tables t ON t.id=s.table_id
      WHERE t.floor_number=3 AND b.start_at >= now()-interval '12 weeks'
      GROUP BY week_start ORDER BY week_start`),
    pool.query(`SELECT date_trunc('month', b.start_at)::date AS month_start, count(*)::integer AS reservations
      FROM bookings b JOIN seats s ON s.id=b.seat_id JOIN library_tables t ON t.id=s.table_id
      WHERE t.floor_number=3 AND b.start_at >= now()-interval '12 months'
      GROUP BY month_start ORDER BY month_start`),
    pool.query(`SELECT s.table_id, count(*)::integer AS reservations FROM bookings b JOIN seats s ON s.id = b.seat_id
      JOIN library_tables t ON t.id = s.table_id WHERE t.floor_number = 3 AND b.status <> 'cancelled'
      GROUP BY s.table_id ORDER BY reservations DESC, s.table_id LIMIT 10`),
    pool.query(`SELECT CASE WHEN t.outdoor THEN 'outdoor' ELSE 'indoor' END AS zone,
      count(*)::integer AS reservations FROM bookings b JOIN seats s ON s.id=b.seat_id
      JOIN library_tables t ON t.id=s.table_id WHERE t.floor_number=3 AND b.status<>'cancelled'
      GROUP BY zone ORDER BY zone`),
    pool.query(`SELECT extract(hour FROM b.start_at)::integer AS hour, count(*)::integer AS reservations
      FROM bookings b JOIN seats s ON s.id = b.seat_id JOIN library_tables t ON t.id = s.table_id
      WHERE t.floor_number = 3 AND b.status <> 'cancelled' GROUP BY hour ORDER BY hour`),
    pool.query(`SELECT count(*)::integer AS total, count(*) FILTER (WHERE b.status = 'cancelled')::integer AS cancelled,
      avg(extract(epoch FROM b.end_at - b.start_at) / 60)::numeric(10,1) AS average_minutes
      FROM bookings b JOIN seats s ON s.id = b.seat_id JOIN library_tables t ON t.id = s.table_id WHERE t.floor_number = 3`),
    pool.query(`SELECT max(reservation_date) AS latest_date, count(*)::integer AS rows FROM seat_usage_daily`),
  ]);
  const status = Object.fromEntries(seats.rows.map(({ status: key, count }) => [key, count]));
  const totalSeats = Object.values(status).reduce((sum, count) => sum + count, 0);
  const bookingTotal = Number(totals.rows[0].total || 0);
  const cancellationRate = bookingTotal ? Number((Number(totals.rows[0].cancelled) / bookingTotal * 100).toFixed(1)) : 0;
  res.json({ floorNumber: 3, generatedAt: new Date().toISOString(), seats: { total: totalSeats, ...status,
    occupiedRate: totalSeats ? Number((((status.booked || 0) + (status.occupied || 0)) / totalSeats * 100).toFixed(1)) : 0 },
    bookings: { ...totals.rows[0], cancellationRate }, daily: daily.rows, weekly: weekly.rows, monthly: monthly.rows,
    popularTables: tables.rows, zones: zones.rows, peakHours: hours.rows,
    materializedUsage: { ...materialized.rows[0], freshnessNote: "This summary can be stale until an administrator refreshes it." } });
});

app.get("/api/admin/database/query-plan", requireUser, requireAdministrator, async (req, res) => {
  const plans = {
    availability: `SELECT s.id FROM seats s JOIN library_tables t ON t.id = s.table_id
      WHERE t.floor_number = 3 AND EXISTS (SELECT 1 FROM bookings b WHERE b.seat_id = s.id
        AND b.status = 'confirmed' AND b.start_at <= now() AND b.end_at > now())`,
    bookings: `SELECT id, seat_id, start_at, end_at, status FROM bookings WHERE user_id = $1 ORDER BY start_at DESC LIMIT 100`,
  };
  const name = String(req.query.query || "");
  const query = plans[name];
  if (!query) return res.status(400).json({ error: "Choose availability or bookings." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const result = name === "bookings"
      ? await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`, [req.user.id])
      : await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`);
    await client.query("ROLLBACK");
    return res.json({ queryName: name, plan: result.rows[0]["QUERY PLAN"][0], note: "EXPLAIN ANALYZE ran a fixed read-only query against PostgreSQL." });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
});

app.get("/api/admin/database/audit", requireUser, requireAdministrator, async (_req, res) => {
  try { return res.json({ events: await (await import("./events.js")).recentActivity(200), store: "MongoDB activity_events" }); }
  catch { return res.status(503).json({ error: "MongoDB audit events are unavailable." }); }
});

app.post("/api/admin/database/refresh-usage", requireUser, requireAdministrator, async (req, res) => {
  await pool.query("REFRESH MATERIALIZED VIEW CONCURRENTLY seat_usage_daily");
  await audit({ action: "database.usage_refreshed", actorId: req.user.id, entityType: "materialized_view", entityId: "seat_usage_daily" });
  res.json({ refreshed: true, view: "seat_usage_daily", refreshedAt: new Date().toISOString() });
});

app.get("/api/floors/3/availability", async (req, res) => {
  const range = parseRange(req.query);
  if (!range) return res.status(400).json({ error: "Choose a valid time range of no more than four hours." });
  await expireBookings();
  const result = await pool.query(
    `SELECT s.id AS "seatId", t.id AS "tableId",
       CASE WHEN EXISTS (
         SELECT 1 FROM bookings b WHERE b.seat_id = s.id AND b.status = 'confirmed'
           AND b.checked_in_at IS NOT NULL
           AND b.start_at <= now() AND b.end_at > now()
           AND tstzrange(b.start_at, b.end_at, '[)') && tstzrange($1, $2, '[)')
       ) THEN 'occupied'
       WHEN EXISTS (
         SELECT 1 FROM bookings b WHERE b.seat_id = s.id AND b.status = 'confirmed'
           AND tstzrange(b.start_at, b.end_at, '[)') && tstzrange($1, $2, '[)')
       ) THEN 'booked'
       WHEN EXISTS (
         SELECT 1 FROM seat_maintenance m WHERE m.seat_id = s.id
           AND tstzrange(m.start_at, m.end_at, '[)') && tstzrange($1, $2, '[)')
       ) THEN 'unavailable' ELSE 'available' END AS status,
       current_booking.start_at AS "currentStartAt",
       current_booking.end_at AS "currentEndAt",
       current_booking.checked_in_at AS "currentCheckedInAt",
       range_booking.start_at AS "reservationStartAt",
       range_booking.end_at AS "reservationEndAt",
       range_booking.checked_in_at AS "reservationCheckedInAt"
     FROM seats s JOIN library_tables t ON t.id = s.table_id
     LEFT JOIN LATERAL (
       SELECT b.start_at, b.end_at, b.checked_in_at
       FROM bookings b
       WHERE b.seat_id = s.id AND b.status = 'confirmed'
         AND b.checked_in_at IS NOT NULL AND b.start_at <= now() AND b.end_at > now()
       ORDER BY b.start_at LIMIT 1
     ) current_booking ON true
     LEFT JOIN LATERAL (
       SELECT b.start_at, b.end_at, b.checked_in_at
       FROM bookings b
       WHERE b.seat_id = s.id AND b.status = 'confirmed'
         AND tstzrange(b.start_at, b.end_at, '[)') && tstzrange($1, $2, '[)')
       ORDER BY b.start_at LIMIT 1
     ) range_booking ON true
     WHERE t.floor_number = 3 ORDER BY t.id, s.seat_number`,
    [range.startAt, range.endAt],
  );
  res.json({ floorNumber: 3, startAt: range.startAt, endAt: range.endAt, seats: result.rows });
});

app.post("/api/bookings", requireUser, async (req, res) => {
  const input = bookingSchema.parse(req.body);
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  const windowError = bookingWindowError(startAt, endAt);
  if (windowError) return res.status(400).json({ error: windowError });

  await expireBookings();
  const deadline = new Date(startAt.getTime() + checkInGraceMinutes() * 60_000);
  try {
    const booking = await withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [input.seatId]);
      const seat = await client.query(
        "SELECT id FROM seats WHERE id = $1 AND EXISTS (SELECT 1 FROM library_tables WHERE id = seats.table_id AND floor_number = 3)",
        [input.seatId],
      );
      if (!seat.rowCount) {
        const error = new Error("That seat does not exist on the third floor.");
        error.status = 404;
        throw error;
      }
      const unavailable = await client.query(
        `SELECT EXISTS (SELECT 1 FROM bookings WHERE seat_id = $1 AND status = 'confirmed' AND tstzrange(start_at, end_at, '[)') && tstzrange($2, $3, '[)'))
          OR EXISTS (SELECT 1 FROM seat_maintenance WHERE seat_id = $1 AND tstzrange(start_at, end_at, '[)') && tstzrange($2, $3, '[)')) AS unavailable`,
        [input.seatId, startAt, endAt],
      );
      if (unavailable.rows[0].unavailable) {
        const error = new Error("That seat is no longer available for the selected time.");
        error.status = 409;
        throw error;
      }
      const created = await client.query(
        `INSERT INTO bookings (seat_id, user_id, start_at, end_at, check_in_deadline)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, seat_id AS "seatId", user_id AS "userId", start_at AS "startAt", end_at AS "endAt",
           check_in_deadline AS "checkInDeadline", checked_in_at AS "checkedInAt", checked_out_at AS "checkedOutAt", status`,
        [input.seatId, req.user.id, startAt, endAt, deadline],
      );
      return created.rows[0];
    });
    const auditStored = await audit({ action: "booking.created", actorId: req.user.id, entityType: "booking", entityId: booking.id, metadata: { seatId: booking.seatId } });
    res.status(201).json({ booking, auditStored });
  } catch (error) {
    if (error.code === "23P01") return res.status(409).json({ error: "That seat has just been booked for an overlapping time." });
    throw error;
  }
});

app.get("/api/bookings/mine", requireUser, async (req, res) => {
  await expireBookings();
  const result = await pool.query(
    `SELECT b.id, b.seat_id AS "seatId", s.table_id AS "tableId", b.start_at AS "startAt", b.end_at AS "endAt",
       b.check_in_deadline AS "checkInDeadline", b.checked_in_at AS "checkedInAt", b.checked_out_at AS "checkedOutAt", b.status
     FROM bookings b JOIN seats s ON s.id = b.seat_id
     WHERE b.user_id = $1 ORDER BY b.start_at DESC LIMIT 100`,
    [req.user.id],
  );
  res.json({ bookings: result.rows });
});

app.patch("/api/bookings/:id/cancel", requireUser, async (req, res) => {
  const result = await pool.query(
    `UPDATE bookings SET status = 'cancelled', cancelled_at = now()
     WHERE id = $1 AND user_id = $2 AND status = 'confirmed' AND checked_in_at IS NULL
     RETURNING id, seat_id AS "seatId", start_at AS "startAt", end_at AS "endAt", status`,
    [req.params.id, req.user.id],
  );
  if (!result.rowCount) return res.status(404).json({ error: "No cancellable booking was found for this account." });
  await audit({ action: "booking.cancelled", actorId: req.user.id, entityType: "booking", entityId: req.params.id });
  res.json({ booking: result.rows[0] });
});

app.post("/api/bookings/:id/check-in", requireUser, async (req, res) => {
  const booking = await withTransaction(async (client) => {
    const found = await client.query(
      `SELECT id, user_id, status, start_at, check_in_deadline, checked_in_at
       FROM bookings WHERE id = $1 FOR UPDATE`,
      [req.params.id],
    );
    if (!found.rowCount || found.rows[0].user_id !== req.user.id) {
      const error = new Error("Booking not found for this account."); error.status = 404; throw error;
    }
    const current = found.rows[0];
    const time = await client.query("SELECT now() AS now");
    const decision = checkInDecision({
      status: current.status,
      checkedInAt: current.checked_in_at,
      startAt: current.start_at,
      checkInDeadline: current.check_in_deadline,
    }, time.rows[0].now);
    if (decision === "already_checked_in") return current;
    if (decision) {
      const message = decision === "inactive"
        ? "This booking is no longer eligible for check-in."
        : "Check-in is available from the booking start until its grace-period deadline.";
      const error = new Error(message); error.status = 409; throw error;
    }
    const updated = await client.query(
      `UPDATE bookings SET checked_in_at = now()
       WHERE id = $1 AND status = 'confirmed' AND checked_in_at IS NULL
       RETURNING id, seat_id AS "seatId", start_at AS "startAt", end_at AS "endAt",
         check_in_deadline AS "checkInDeadline", checked_in_at AS "checkedInAt", checked_out_at AS "checkedOutAt", status`,
      [req.params.id],
    );
    return updated.rows[0];
  });
  await audit({ action: "booking.checked_in", actorId: req.user.id, entityType: "booking", entityId: booking.id, metadata: { seatId: booking.seatId } });
  res.json({ booking });
});

app.post("/api/bookings/:id/check-out", requireUser, async (req, res) => {
  const booking = await withTransaction(async (client) => {
    const found = await client.query(
      `SELECT id, user_id, status, checked_in_at FROM bookings WHERE id = $1 FOR UPDATE`,
      [req.params.id],
    );
    if (!found.rowCount || found.rows[0].user_id !== req.user.id) {
      const error = new Error("Booking not found for this account."); error.status = 404; throw error;
    }
    const current = found.rows[0];
    if (current.status !== "confirmed" || !current.checked_in_at) {
      const error = new Error("Check-out is only available after you have checked in."); error.status = 409; throw error;
    }
    const updated = await client.query(
      `UPDATE bookings SET status = 'completed', checked_out_at = now()
       WHERE id = $1 AND status = 'confirmed' AND checked_in_at IS NOT NULL
       RETURNING id, seat_id AS "seatId", start_at AS "startAt", end_at AS "endAt",
         check_in_deadline AS "checkInDeadline", checked_in_at AS "checkedInAt", checked_out_at AS "checkedOutAt", status`,
      [req.params.id],
    );
    return updated.rows[0];
  });
  await audit({ action: "booking.checked_out", actorId: req.user.id, entityType: "booking", entityId: booking.id, metadata: { seatId: booking.seatId } });
  res.json({ booking });
});

app.use((_req, res) => res.status(404).json({ error: "That endpoint was not found." }));

app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError) return res.status(400).json({ error: "Please check the submitted information.", fields: error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) });
  if (error.code === "23503") return res.status(404).json({ error: "The requested seat or account could not be found." });
  console.error("API request failed:", error.message);
  return res.status(error.status || 500).json({ error: error.status ? error.message : "The request could not be completed. Please try again." });
});

export default app;
