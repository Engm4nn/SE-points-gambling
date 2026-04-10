import { getDb, ensureTables } from './db.js';
import { getChannelId, seAddPoints } from './se.js';
import { requireAuth } from './session.js';

const MAX_SINGLE_PAYOUT = 10000000;

const GAME_MAX_MULT = {
  slots: 10000,
  gates: 5000,
  blackjack: 2.5,
  roulette: 36,
  mines: 100,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const session = await requireAuth(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    const user = session.username;
    await ensureTables();
    const db = getDb();
    const { channelId, jwt } = await getChannelId();
    const { amount: rawAmount, game, betId } = req.body || {};

    if (!game || !betId) return res.status(400).json({ error: 'Missing fields' });

    const amount = Math.floor(Number(rawAmount));
    if (amount <= 0 || amount > MAX_SINGLE_PAYOUT) return res.status(400).json({ error: 'Invalid amount' });

    const validGames = Object.keys(GAME_MAX_MULT);
    if (!validGames.includes(game)) return res.status(400).json({ error: 'Invalid game' });

    const betRows = await db`
      SELECT id, username, amount, game, status, created_at
      FROM bets WHERE id = ${betId}
    `;
    if (betRows.length === 0) return res.status(404).json({ error: 'Bet not found' });

    const bet = betRows[0];
    if (bet.username !== user) return res.status(403).json({ error: 'Bet does not belong to user' });
    if (bet.game !== game) return res.status(400).json({ error: 'Game mismatch' });
    if (bet.status !== 'active') return res.status(400).json({ error: 'Bet already paid out' });

    if (Date.now() - new Date(bet.created_at).getTime() > 5 * 60 * 1000) {
      await db`UPDATE bets SET status = 'expired' WHERE id = ${betId}`;
      return res.status(400).json({ error: 'Bet expired' });
    }

    const betAmount = bet.amount;
    const maxAllowed = Math.floor(betAmount * GAME_MAX_MULT[game]);
    if (amount > maxAllowed) return res.status(400).json({ error: 'Payout exceeds game maximum' });

    const recent = await db`
      SELECT SUM(amount) as total, COUNT(*) as count
      FROM payout_log
      WHERE username = ${user} AND created_at > NOW() - INTERVAL '1 minute'
    `;
    const recentTotal = Number(recent[0]?.total ?? 0);
    const recentCount = Number(recent[0]?.count ?? 0);
    if (recentCount >= 30) return res.status(429).json({ error: 'Too many payouts' });
    if (recentTotal + amount > 500000) return res.status(429).json({ error: 'Payout rate limit exceeded' });

    await seAddPoints(channelId, jwt, user, amount);

    await db`UPDATE bets SET status = 'paid' WHERE id = ${betId}`;

    await db`
      INSERT INTO payout_log (username, amount, game) VALUES (${user}, ${amount}, ${game})
    `;

    return res.json({ ok: true, amount, username: user });
  } catch (err) {
    console.error('Payout error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
