import { getDb, ensureTables } from './db.js';
import { requireAuth } from './session.js';

const JACKPOT_SEED = 5000;
const GROWTH_PER_MINUTE = 10;

async function ensureJackpotTable() {
  const db = getDb();
  await db`
    CREATE TABLE IF NOT EXISTS jackpot (
      id INT PRIMARY KEY DEFAULT 1,
      amount BIGINT NOT NULL DEFAULT 5000,
      last_won_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_growth_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  const rows = await db`SELECT id FROM jackpot WHERE id = 1`;
  if (rows.length === 0) {
    await db`INSERT INTO jackpot (id, amount) VALUES (1, 5000)`;
  }
}

async function applyTimeGrowth(db) {
  const rows = await db`SELECT amount, last_growth_at FROM jackpot WHERE id = 1`;
  if (!rows[0]) return;

  const lastGrowth = new Date(rows[0].last_growth_at);
  const now = new Date();
  const minutesElapsed = (now - lastGrowth) / 60000;

  if (minutesElapsed >= 1) {
    const growth = Math.floor(minutesElapsed * GROWTH_PER_MINUTE);
    if (growth > 0) {
      await db`
        UPDATE jackpot
        SET amount = amount + ${growth}, last_growth_at = NOW()
        WHERE id = 1
      `;
    }
  }
}

export default async function handler(req, res) {
  try {
    await ensureTables();
    await ensureJackpotTable();
    const db = getDb();

    if (req.method === 'GET') {
      await applyTimeGrowth(db);
      const rows = await db`SELECT amount, last_won_at FROM jackpot WHERE id = 1`;
      const row = rows[0];
      return res.json({
        jackpot: Number(row?.amount ?? JACKPOT_SEED),
        lastWonAt: row?.last_won_at ?? null,
      });

    } else if (req.method === 'POST') {
      const session = await requireAuth(req);
      if (!session) return res.status(401).json({ error: 'Not authenticated' });

      const { action, amount } = req.body || {};

      if (action === 'contribute' && typeof amount === 'number' && amount > 0) {
        const contrib = Math.floor(amount);
        await db`UPDATE jackpot SET amount = amount + ${contrib} WHERE id = 1`;
        const rows = await db`SELECT amount FROM jackpot WHERE id = 1`;
        return res.json({ jackpot: Number(rows[0]?.amount ?? JACKPOT_SEED) });

      } else if (action === 'win') {
        await applyTimeGrowth(db);
        const rows = await db`SELECT amount FROM jackpot WHERE id = 1`;
        const won = Number(rows[0]?.amount ?? JACKPOT_SEED);
        await db`
          UPDATE jackpot
          SET amount = ${JACKPOT_SEED}, last_won_at = NOW(), last_growth_at = NOW()
          WHERE id = 1
        `;
        return res.json({ won, jackpot: JACKPOT_SEED });

      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Jackpot error:', err);
    return res.status(500).json({ error: 'Database error: ' + err.message });
  }
}
