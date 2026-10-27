import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Strip sslmode from URL so Pool ssl options win (Supabase pooler uses a
// cert chain that fails verify-full / SELF_SIGNED_CERT_IN_CHAIN under pg v8+).
const connectionString = process.env.DATABASE_URL.replace(
  /([?&])sslmode=[^&]*/g,
  "$1",
).replace(/[?&]$/, "");

const pool = new Pool({
  connectionString,
  max: Math.max(1, Number(process.env.DB_POOL_MAX) || 3),
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false },
});

export { pool };
export const db = drizzle(pool, { schema });

process.on("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});
