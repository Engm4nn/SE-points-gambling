import { getDb, ensureTables } from './db.js';
import { getChannelId, seDeductPoints, seAddPoints, seGetPoints } from './se.js';
import { requireAuth } from './session.js';

const VALID_GAMES = ['slots', 'gates', 'blackjack', 'roulette', 'mines'];
const MAX_BET = 100000;
const MIN_BET = 10;
const MAX_ACTIVE_BETS_PER_USER = 10;
const BET_EXPIRY_MS = 10 * 60 * 1000;

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
    const { action } = req.body || {};

    if (action === 'place') {
      return await handlePlace(req, res, user);
    } else if (action === 'settle') {
      return await handleSettle(req, res, user);
    } else if (action === 'deduct') {
      return await handleDeduct(req, res, user);
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err) {
    console.error('Bet error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

async function handlePlace(req, res, user) {
  const { game, amount: rawAmount } = req.body || {};

  if (!game || !VALID_GAMES.includes(game)) return res.status(400).json({ error: 'Invalid game' });
  const amount = Math.floor(Number(rawAmount));
  if (amount < MIN_BET || amount > MAX_BET) return res.status(400).json({ error: `Bet must be ${MIN_BET}–${MAX_BET.toLocaleString()}` });

  await ensureTables();
  const db = getDb();
  const { channelId, jwt } = await getChannelId();

  const activeCount = await db`
    SELECT COUNT(*) as count FROM bets
    WHERE username = ${user} AND status = 'active'
  `;
  if (Number(activeCount[0].count) >= MAX_ACTIVE_BETS_PER_USER) {
    return res.status(429).json({ error: 'Too many active bets' });
  }

  const recentBets = await db`
    SELECT COUNT(*) as count FROM bets
    WHERE username = ${user} AND created_at > NOW() - INTERVAL '5 seconds'
  `;
  if (Number(recentBets[0].count) >= 5) {
    return res.status(429).json({ error: 'Too many bets, slow down' });
  }

  const balance = await seGetPoints(channelId, jwt, user);
  if (balance < amount) return res.status(400).json({ error: 'Not enough points' });

  await seDeductPoints(channelId, jwt, user, amount);

  const betResult = await db`
    INSERT INTO bets (username, amount, game, status)
    VALUES (${user}, ${amount}, ${game}, 'active')
    RETURNING id
  `;

  return res.json({ betId: betResult[0].id, balance: balance - amount });
}

async function handleSettle(req, res, user) {
  const { betId, payout: rawPayout } = req.body || {};
  if (!betId) return res.status(400).json({ error: 'Missing betId' });
  const payout = Math.floor(Number(rawPayout));

  await ensureTables();
  const db = getDb();
  const { channelId, jwt } = await getChannelId();

  const betRows = await db`
    SELECT id, username, amount, game, status, created_at
    FROM bets WHERE id = ${betId}
  `;
  if (betRows.length === 0) return res.status(404).json({ error: 'Bet not found' });

  const bet = betRows[0];
  if (bet.username !== user) return res.status(403).json({ error: 'Not your bet' });
  if (bet.status !== 'active') return res.status(400).json({ error: 'Bet already settled' });

  if (Date.now() - new Date(bet.created_at).getTime() > BET_EXPIRY_MS) {
    await db`UPDATE bets SET status = 'expired' WHERE id = ${betId}`;
    return res.status(400).json({ error: 'Bet expired' });
  }

  if (payout < 0) return res.status(400).json({ error: 'Invalid payout' });

  const maxAllowed = Math.floor(bet.amount * GAME_MAX_MULT[bet.game]);
  if (payout > maxAllowed) return res.status(400).json({ error: 'Payout exceeds maximum for this game' });

  const recent = await db`
    SELECT SUM(amount) as total, COUNT(*) as count
    FROM payout_log
    WHERE username = ${user} AND created_at > NOW() - INTERVAL '1 minute'
  `;
  const recentTotal = Number(recent[0]?.total ?? 0);
  const recentCount = Number(recent[0]?.count ?? 0);
  if (recentCount >= 30) return res.status(429).json({ error: 'Too many payouts' });
  if (recentTotal + payout > 500000) return res.status(429).json({ error: 'Payout rate limit exceeded' });

  if (payout > 0) {
    await seAddPoints(channelId, jwt, user, payout);
  }

  await db`UPDATE bets SET status = 'paid' WHERE id = ${betId}`;

  if (payout > 0) {
    await db`
      INSERT INTO payout_log (username, amount, game) VALUES (${user}, ${payout}, ${bet.game})
    `;
  }

  return res.json({ ok: true, payout, username: user });
}

async function handleDeduct(req, res, user) {
  const { game, amount: rawAmount } = req.body || {};

  if (!game || !VALID_GAMES.includes(game)) return res.status(400).json({ error: 'Invalid game' });
  const amount = Math.floor(Number(rawAmount));
  if (amount < MIN_BET || amount > MAX_BET) return res.status(400).json({ error: `Bet must be ${MIN_BET}–${MAX_BET.toLocaleString()}` });

  await ensureTables();
  const db = getDb();
  const { channelId, jwt } = await getChannelId();

  const activeCount = await db`
    SELECT COUNT(*) as count FROM bets
    WHERE username = ${user} AND status = 'active'
  `;
  if (Number(activeCount[0].count) >= MAX_ACTIVE_BETS_PER_USER) {
    return res.status(429).json({ error: 'Too many active bets' });
  }

  const recentBets = await db`
    SELECT COUNT(*) as count FROM bets
    WHERE username = ${user} AND created_at > NOW() - INTERVAL '5 seconds'
  `;
  if (Number(recentBets[0].count) >= 5) {
    return res.status(429).json({ error: 'Too many bets, slow down' });
  }

  const balance = await seGetPoints(channelId, jwt, user);
  if (balance < amount) return res.status(400).json({ error: 'Not enough points' });

  await seDeductPoints(channelId, jwt, user, amount);

  const betResult = await db`
    INSERT INTO bets (username, amount, game, status)
    VALUES (${user}, ${amount}, ${game}, 'active')
    RETURNING id
  `;

  return res.json({ betId: betResult[0].id, balance: balance - amount });
}
