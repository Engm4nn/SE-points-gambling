import { SYMBOLS, BONUS_SYMBOL, BONUS_TRIGGER_CHANCE, WIN_TABLE, SYMBOLS_PER_STRIP } from './constants';

// Build a weighted symbol pool for reel strips
function buildWeightedPool() {
  const pool = [];
  for (const sym of SYMBOLS) {
    for (let i = 0; i < sym.weight; i++) {
      pool.push(sym);
    }
  }
  return pool;
}

const WEIGHTED_POOL = buildWeightedPool();

// Generate a full reel strip (array of symbols)
export function generateReelStrip(length = SYMBOLS_PER_STRIP) {
  const strip = [];
  for (let i = 0; i < length; i++) {
    // Small chance to insert bonus symbol
    if (Math.random() < BONUS_TRIGGER_CHANCE) {
      strip.push({ ...BONUS_SYMBOL });
    } else {
      const idx = Math.floor(Math.random() * WEIGHTED_POOL.length);
      strip.push({ ...WEIGHTED_POOL[idx] });
    }
  }
  return strip;
}

// Pick a random symbol from weighted pool (for the active line result)
export function pickSymbol() {
  const idx = Math.floor(Math.random() * WEIGHTED_POOL.length);
  return { ...WEIGHTED_POOL[idx] };
}

// Spin: returns 3 symbols for the active line
export function spinReels() {
  return [pickSymbol(), pickSymbol(), pickSymbol()];
}

// Check if bonus triggered (all 3 reels have bonus symbol on active line)
export function isBonusTriggered(results) {
  return results.every(s => s.id === 'bonus');
}

// Evaluate win from 3 symbols
export function evaluateWin(results, bet, jackpotPool) {
  const ids = results.map(r => r.id);

  // Check bonus
  if (isBonusTriggered(results)) {
    return { type: 'bonus', multiplier: 0, winAmount: 0, label: 'BONUS TRIGGERED!' };
  }

  // Count occurrences
  const counts = {};
  for (const id of ids) {
    counts[id] = (counts[id] || 0) + 1;
  }

  // Check 3-of-a-kind first
  for (const id of Object.keys(counts)) {
    if (counts[id] === 3) {
      // Find specific match in win table
      for (const entry of WIN_TABLE) {
        if (entry.count === 3 && entry.ids && entry.ids.includes(id)) {
          if (entry.multiplier === 'jackpot') {
            return { type: 'jackpot', multiplier: 0, winAmount: jackpotPool, label: 'JACKPOT!' };
          }
          return { type: 'win', multiplier: entry.multiplier, winAmount: Math.floor(bet * entry.multiplier), label: entry.label };
        }
      }
      // Generic 3-of-a-kind
      const generic = WIN_TABLE.find(e => e.count === 3 && e.ids === null);
      return { type: 'win', multiplier: generic.multiplier, winAmount: Math.floor(bet * generic.multiplier), label: generic.label };
    }
  }

  // Check 2-of-a-kind
  for (const id of Object.keys(counts)) {
    if (counts[id] === 2) {
      for (const entry of WIN_TABLE) {
        if (entry.count === 2 && entry.ids && entry.ids.includes(id)) {
          return { type: 'win', multiplier: entry.multiplier, winAmount: Math.floor(bet * entry.multiplier), label: entry.label };
        }
      }
      // Generic 2-of-a-kind
      const generic = WIN_TABLE.find(e => e.count === 2 && e.ids === null);
      return { type: 'win', multiplier: generic.multiplier, winAmount: Math.floor(bet * generic.multiplier), label: generic.label };
    }
  }

  // No match
  return { type: 'loss', multiplier: 0, winAmount: 0, label: 'No match' };
}

// Check for near-miss (2 jackpot symbols)
export function isNearMiss(results) {
  return results.filter(s => s.id === 'seven').length === 2;
}
