/** Idempotent: tabla analytics_events. Seguro llamar en cada boot. NO db:push. */
import { sql } from "drizzle-orm";
import { db } from "./db";

export async function ensureAnalyticsEventsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id bigserial PRIMARY KEY,
        ts timestamptz NOT NULL DEFAULT now(),
        visitor_id text NOT NULL,
        session_id text NOT NULL,
        user_id integer,
        path text NOT NULL DEFAULT '/',
        event_type text NOT NULL,
        event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
        referrer text,
        device text,
        city text,
        duration_ms integer
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS analytics_events_ts_idx ON analytics_events (ts DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS analytics_events_type_ts_idx ON analytics_events (event_type, ts DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS analytics_events_visitor_ts_idx ON analytics_events (visitor_id, ts DESC)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS analytics_events_path_ts_idx ON analytics_events (path, ts DESC)`);
    console.log("[migrate] analytics_events OK");
  } catch (e) {
    console.error("[migrate] analytics_events failed (non-fatal):", e);
  }
}
