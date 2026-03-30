import { getDb, ensureTables } from './db.js';

const JACKPOT_SEED = 5000;

async function ensureJackpotTable() {
  const db = getDb();
  await db`
    CREATE TABLE IF NOT EXISTS jackpot (
      id INT PRIMARY KEY DEFAULT 1,
      amount BIGINT NOT NULL DEFAULT ${JACKPOT_SEED}
    )
  `;
  // Seed if empty
  await db`
    INSERT INTO jackpot (id, amount) VALUES (1, ${JACKPOT_SEED})
    ON CONFLICT (id) DO NOTHING
  `;
}

export default async function handler(req, res) {
  try {
    await ensureTables();
    await ensureJackpotTable();
    const db = getDb();

    if (req.method === 'GET') {
      const rows = await db`SELECT amount FROM jackpot WHERE id = 1`;
      return res.json({ jackpot: rows[0]?.amount ?? JACKPOT_SEED });

    } else if (req.method === 'POST') {
      const { action, amount } = req.body || {};

      if (action === 'contribute' && typeof amount === 'number' && amount > 0) {
        // Add to jackpot (from losses)
        await db`UPDATE jackpot SET amount = amount + ${Math.floor(amount)} WHERE id = 1`;
        const rows = await db`SELECT amount FROM jackpot WHERE id = 1`;
        return res.json({ jackpot: rows[0]?.amount ?? JACKPOT_SEED });

      } else if (action === 'win') {
        // Someone won the jackpot — get current value, reset to seed
        const rows = await db`SELECT amount FROM jackpot WHERE id = 1`;
        const won = rows[0]?.amount ?? JACKPOT_SEED;
        await db`UPDATE jackpot SET amount = ${JACKPOT_SEED} WHERE id = 1`;
        return res.json({ won, jackpot: JACKPOT_SEED });

      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Jackpot error:', err);
    return res.status(500).json({ error: 'Database error' });
  }
}
