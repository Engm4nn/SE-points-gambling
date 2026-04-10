import { getDb, ensureTables } from './db.js';
import { getChannelId, seDeductPoints, seAddPoints, seGetPoints } from './se.js';
import { requireAuth } from './session.js';

const MAX_BET = 10000;
const MIN_BET = 10;
const MAX_STREAK_AGE_MS = 10 * 60 * 1000;

function flipCoin() {
  return Math.random() < 0.5 ? 'heads' : 'tails';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const session = await requireAuth(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    const user = session.username;
    await ensureTables();
    const db = getDb();
    const { channelId, jwt } = await getChannelId();

    const body = req.body || {};
    const { action } = body;

    if (action === 'flip') {
      const { amount: rawAmount, choice } = body;
      if (!choice) return res.status(400).json({ error: 'Missing choice' });
      if (!['heads', 'tails'].includes(choice)) return res.status(400).json({ error: 'Invalid choice' });

      const amount = Math.floor(Number(rawAmount));
      if (amount < MIN_BET || amount > MAX_BET) return res.status(400).json({ error: `Bet must be ${MIN_BET}–${MAX_BET.toLocaleString()}` });

      const balance = await seGetPoints(channelId, jwt, user);
      if (balance < amount) return res.status(400).json({ error: 'Not enough points' });

      await seDeductPoints(channelId, jwt, user, amount);

      const result = flipCoin();
      const won = result === choice;
      const pot = won ? amount * 2 : 0;

      if (won) {
        const rows = await db`
          INSERT INTO coinflip_bets (username, bet_amount, pot, choice, streak, status)
          VALUES (${user}, ${amount}, ${pot}, ${choice}, 0, 'active')
          RETURNING id
        `;
        return res.json({ betId: rows[0].id, result, won, pot });
      }

      return res.json({ betId: null, result, won: false, pot: 0 });

    } else if (action === 'double') {
      const { betId } = body;
      if (!betId) return res.status(400).json({ error: 'Missing betId' });

      const rows = await db`
        SELECT id, username, bet_amount, pot, choice, streak, status, created_at
        FROM coinflip_bets WHERE id = ${betId}
      `;
      if (rows.length === 0) return res.status(404).json({ error: 'Bet not found' });

      const bet = rows[0];
      if (bet.username !== user) return res.status(403).json({ error: 'Not your bet' });
      if (bet.status !== 'active') return res.status(400).json({ error: 'Bet already resolved' });
      if (Date.now() - new Date(bet.created_at).getTime() > MAX_STREAK_AGE_MS) {
        await db`UPDATE coinflip_bets SET status = 'expired' WHERE id = ${betId}`;
        await seAddPoints(channelId, jwt, user, bet.pot);
        return res.status(400).json({ error: 'Bet expired, pot returned' });
      }

      const result = flipCoin();
      const won = result === bet.choice;

      if (won) {
        const newPot = bet.pot * 2;
        const newStreak = bet.streak + 1;
        await db`
          UPDATE coinflip_bets SET pot = ${newPot}, streak = ${newStreak} WHERE id = ${betId}
        `;
        return res.json({ betId, result, won: true, pot: newPot, streak: newStreak });
      }

      await db`UPDATE coinflip_bets SET status = 'lost' WHERE id = ${betId}`;
      return res.json({ betId, result, won: false, pot: 0, streak: bet.streak });

    } else if (action === 'cashout') {
      const { betId } = body;
      if (!betId) return res.status(400).json({ error: 'Missing betId' });

      const rows = await db`
        SELECT id, username, pot, status FROM coinflip_bets WHERE id = ${betId}
      `;
      if (rows.length === 0) return res.status(404).json({ error: 'Bet not found' });

      const bet = rows[0];
      if (bet.username !== user) return res.status(403).json({ error: 'Not your bet' });
      if (bet.status !== 'active') return res.status(400).json({ error: 'Bet already resolved' });

      await seAddPoints(channelId, jwt, user, bet.pot);
      await db`UPDATE coinflip_bets SET status = 'cashed_out' WHERE id = ${betId}`;

      return res.json({ payout: bet.pot });

    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err) {
    console.error('Coinflip error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
