import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pool from "./db.js";

const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
const safeIndividualMigrations = new Set([
  "005_database_analysis_views.sql",
  "006_add_student_usn.sql",
]);

try {
  const requested = process.argv[2] === "--only" ? process.argv[3] : null;
  if (process.argv.length > 2 && (!requested || !safeIndividualMigrations.has(requested))) {
    throw new Error(`Only these reviewed additive migrations may be selected individually: ${[...safeIndividualMigrations].join(", ")}.`);
  }
  const allMigrations = (await readdir(directory)).filter((name) => /^\d+_[\w-]+\.sql$/.test(name)).sort();
  const migrations = requested ? allMigrations.filter((name) => name === requested) : allMigrations;
  if (requested && migrations.length !== 1) throw new Error(`Requested migration was not found: ${requested}`);
  for (const name of migrations) {
    console.log(`Applying ${name}…`);
    await pool.query(await readFile(path.join(directory, name), "utf8"));
    console.log(`Migration ${name} applied (idempotent additive SQL).`);
  }
} catch (error) {
  console.error("Migration failed:", error?.stack || error?.message || error?.code || String(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
