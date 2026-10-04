import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema";

// Configurar WebSocket para Neon
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configuración optimizada para Replit
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Default 3 (histórico). Con el endpoint -pooler de Neon se puede subir vía DB_POOL_MAX (p. ej. 8).
  max: Math.max(1, Number(process.env.DB_POOL_MAX) || 3),
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 5000,
};

export const pool = new Pool(poolConfig);
export const db = drizzle(pool, { schema });

// Graceful shutdown
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});