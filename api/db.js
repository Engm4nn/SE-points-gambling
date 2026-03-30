import { neon } from '@neondatabase/serverless';

let sql;

export function getDb() {
  if (!sql) {
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

// Run once to create tables — safe to call multiple times (IF NOT EXISTS)
export async function ensureTables() {
  const db = getDb();
  await db`
    CREATE TABLE IF NOT EXISTS wagers (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      total_wagered BIGINT NOT NULL DEFAULT 0,
      total_won BIGINT NOT NULL DEFAULT 0,
      total_spins INT NOT NULL DEFAULT 0,
      last_active TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_wagers_username ON wagers (username)
  `;
}
