import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// pg + SSL (Supabase / Neon pooler). DB_POOL_MAX sigue aplicando.
const poolConfig: ConstructorParameters<typeof Pool>[0] = {
  connectionString: process.env.DATABASE_URL,
  max: Math.max(1, Number(process.env.DB_POOL_MAX) || 3),
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false },
};

export const pool = new Pool(poolConfig);
export const db = drizzle(pool, { schema });

process.on("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});
