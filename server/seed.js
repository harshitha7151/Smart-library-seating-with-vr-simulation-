import "dotenv/config";
import bcrypt from "bcryptjs";
import pool, { withTransaction } from "./db.js";
import { floor3 } from "../src/scene3DData.js";

const accountSeeds = [
  { email: process.env.SEED_STUDENT_EMAIL, password: process.env.SEED_STUDENT_PASSWORD, name: "Demo Student" },
];

try {
  const demo = accountSeeds[0];
  if (Boolean(demo.email) !== Boolean(demo.password) || (demo.password && demo.password.length < 12)) {
    throw new Error("Set both SEED_STUDENT_EMAIL and SEED_STUDENT_PASSWORD; demo password must be at least 12 characters.");
  }

  const layoutAdded = await withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT (SELECT count(*) FROM library_floors)::int AS floors,
              (SELECT count(*) FROM library_tables)::int AS tables,
              (SELECT count(*) FROM seats)::int AS seats`,
    );
    const counts = Object.values(existing.rows[0]);
    const hasLayout = counts.every((count) => count > 0);
    const emptyLayout = counts.every((count) => count === 0);
    if (!hasLayout && !emptyLayout) throw new Error("Seed stopped: the existing floor/table/seat data is incomplete. Inspect it before making changes.");

    if (emptyLayout) {
      await client.query(
      `INSERT INTO library_floors (floor_number, label, layout) VALUES (3, $1, $2::jsonb)`,
      [floor3.label, JSON.stringify({
        zones: floor3.floorZones, walls: floor3.wallSegments, doors: floor3.doors,
        patioBoundaries: floor3.fences, roomLabels: floor3.roomLabels,
        shelves: floor3.shelves, plants: floor3.plants, entrance: floor3.entrance,
        furniture: floor3.furniture, cameraDefault: floor3.cameraDefault,
      })],
      );

    for (const table of floor3.tables) {
      await client.query(
        `INSERT INTO library_tables (id, floor_number, label, seat_count, position, dimensions, outdoor)
         VALUES ($1, 3, $2, $3, $4::jsonb, $5::jsonb, $6)`,
        [table.id, table.label, table.seats, JSON.stringify(table.pos), JSON.stringify(table.size), table.outdoor],
      );
      for (const [index, chair] of table.chairPositions.entries()) {
        const [offsetX, offsetZ, rotation] = chair;
        await client.query(
          `INSERT INTO seats (id, table_id, seat_number, position) VALUES ($1, $2, $3, $4::jsonb)`,
          [`${table.id}-S${index + 1}`, table.id, index + 1,
            JSON.stringify({ x: table.pos[0] + offsetX, z: table.pos[1] + offsetZ, rotation })],
        );
      }
    }
    }

    for (const account of accountSeeds.filter(({ email }) => email)) {
      const passwordHash = await bcrypt.hash(account.password, 12);
      await client.query(
        `INSERT INTO users (email, display_name, password_hash)
         VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING`,
        [account.email.toLowerCase(), account.name, passwordHash],
      );
    }
    return emptyLayout;
  });

  console.log(`Seed complete. Third-floor layout ${layoutAdded ? "added" : "preserved"}; fictional demo student account ${demo.email ? "inserted if new" : "not configured"}.`);
} catch (error) {
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
