import "dotenv/config";
import app, { expireBookings } from "./app.js";
import pool, { closePostgres } from "./db.js";
import { closeMongo, connectEvents } from "./events.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("Set JWT_SECRET in .env to a random value with at least 32 characters.");
  process.exit(1);
}

const port = Number(process.env.PORT) || 4000;

try {
  await pool.query("SELECT 1");
} catch (error) {
  const reason = [error.name, error.code].filter(Boolean).join(" ");
  console.error(`PostgreSQL is unavailable${reason ? ` (${reason})` : ""}. Check the database service and DATABASE_URL.`);
  process.exit(1);
}

try {
  await connectEvents();
  console.log("MongoDB activity event storage connected.");
} catch (error) {
  const reason = [error.name, error.code].filter(Boolean).join(" ");
  console.error(`MongoDB activity event storage is unavailable${reason ? ` (${reason})` : ""}; the API will run with a degraded health status.`);
}

const server = app.listen(port, () => console.log(`SeatSpace API listening on http://localhost:${port}`));
await expireBookings().catch(() => console.error("Could not run booking expiry during startup."));
const expiryTimer = setInterval(() => {
  expireBookings().catch(() => console.error("Booking expiry check failed; it will retry on the next interval."));
}, 30_000);
expiryTimer.unref();

async function shutdown() {
  clearInterval(expiryTimer);
  server.close();
  await Promise.allSettled([closePostgres(), closeMongo()]);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
