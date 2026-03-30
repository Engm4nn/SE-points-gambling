// Slot symbols ordered by rarity (rarest first)
export const SYMBOLS = [
  { id: 'seven',   emoji: '7️⃣',  weight: 2,  label: '7' },
  { id: 'diamond', emoji: '💎', weight: 5,  label: 'Diamond' },
  { id: 'bell',    emoji: '🔔', weight: 10, label: 'Bell' },
  { id: 'cherry',  emoji: '🍒', weight: 15, label: 'Cherry' },
  { id: 'lemon',   emoji: '🍋', weight: 20, label: 'Lemon' },
  { id: 'orange',  emoji: '🍊', weight: 22, label: 'Orange' },
  { id: 'bar',     emoji: '🎰', weight: 26, label: 'Bar' },
];

export const BONUS_SYMBOL = { id: 'bonus', emoji: '🃏', weight: 0, label: 'Bonus' };

// Win multipliers — tuned for 99% RTP
export const WIN_TABLE = [
  { match: 'three_seven',   ids: ['seven'],   count: 3, multiplier: 'jackpot', label: '3× 7️⃣ — JACKPOT' },
  { match: 'three_diamond', ids: ['diamond'], count: 3, multiplier: 40,   label: '3× 💎 — 40×' },
  { match: 'three_bell',    ids: ['bell'],    count: 3, multiplier: 15,   label: '3× 🔔 — 15×' },
  { match: 'three_cherry',  ids: ['cherry'],  count: 3, multiplier: 8,    label: '3× 🍒 — 8×' },
  { match: 'three_any',     ids: null,        count: 3, multiplier: 5,    label: '3× Any — 5×' },
  { match: 'two_seven',     ids: ['seven'],   count: 2, multiplier: 4,    label: '2× 7️⃣ — 4×' },
  { match: 'two_diamond',   ids: ['diamond'], count: 2, multiplier: 3,    label: '2× 💎 — 3×' },
  { match: 'two_any',       ids: null,        count: 2, multiplier: 1.65, label: '2× Any — 1.65×' },
];

// Bet presets
export const BET_PRESETS = [10, 100, 1000, 5000, 10000];
export const MIN_BET = 10;

// Bonus — wheel picks multiplier → 3 spins × E[mult]=3.33 × 0.99 = 9.9 (99% RTP)
export const BONUS_BUY_MULTIPLIER = 10;
export const BONUS_TRIGGER_CHANCE = 0.03; // 3% per reel

// Jackpot
export const JACKPOT_CONTRIBUTION_RATE = 0.01; // 1% of each loss
export const JACKPOT_SEED = 5000;

// Reel config
export const REEL_COUNT = 3;
export const VISIBLE_ROWS = 5;
export const SYMBOLS_PER_STRIP = 40;

// Animation timing (ms)
export const SPIN_DURATION_BASE = 1500;
export const SPIN_STAGGER = 300;

// History
export const HISTORY_MAX = 20;

// Channel name for Twitch embed (public, no secret)
export const CHANNEL_NAME = import.meta.env.VITE_CHANNEL_NAME || '';

// LocalStorage keys (jackpot + leaderboard now in database)
export const LS_KEYS = {
  USERNAME: 'se_slots_username',
  HISTORY: 'se_slots_history',
};
