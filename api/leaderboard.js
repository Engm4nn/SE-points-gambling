import { getDb, ensureTables } from './db.js';
import { requireAuth } from './session.js';

export default async function handler(req, res) {
  try {
    await ensureTables();
    const db = getDb();

    if (req.method === 'GET') {
      const { type, limit } = req.query;
      const maxResults = Math.min(parseInt(limit) || 10, 100);

      if (type === 'all') {
        const rows = await db`
          SELECT username, total_wagered, total_won, total_spins, last_active
          FROM wagers
          ORDER BY total_wagered DESC
          LIMIT ${maxResults}
        `;
        return res.json({ leaderboard: rows });
      }

      const rows = await db`
        SELECT username, total_wagered, total_won, total_spins
        FROM wagers
        ORDER BY total_wagered DESC
        LIMIT 3
      `;
      return res.json({ leaderboard: rows });

    } else if (req.method === 'POST') {
      const session = await requireAuth(req);
      if (!session) return res.status(401).json({ error: 'Not authenticated' });

      const { wagered, won } = req.body || {};
      if (typeof wagered !== 'number') {
        return res.status(400).json({ error: 'Missing wagered' });
      }

      const sanitized = session.username;
      const wonAmount = typeof won === 'number' ? won : 0;

      await db`
        INSERT INTO wagers (username, total_wagered, total_won, total_spins, last_active)
        VALUES (${sanitized}, ${wagered}, ${wonAmount}, 1, NOW())
        ON CONFLICT (username) DO UPDATE SET
          total_wagered = wagers.total_wagered + ${wagered},
          total_won = wagers.total_won + ${wonAmount},
          total_spins = wagers.total_spins + 1,
          last_active = NOW()
      `;

      return res.json({ ok: true });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(500).json({ error: 'Database error' });
  }
}
