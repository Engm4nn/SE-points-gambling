// Mines: 5x5 grid, m mines, reveal safe tiles, cash out anytime
// RTP ~97% — house edge built into multiplier calculation

const GRID_SIZE = 25;
const HOUSE_EDGE = 0.97; // 97% RTP

// Calculate fair multiplier for revealing k safe tiles with m mines
// Fair odds: product of ((25-m-i)/(25-i)) for i=0..k-1
// Then apply house edge
export function getMultiplier(revealed, mineCount) {
  if (revealed === 0) return 1;
  let fair = 1;
  for (let i = 0; i < revealed; i++) {
    fair *= (GRID_SIZE - i) / (GRID_SIZE - mineCount - i);
  }
  return Math.floor(fair * HOUSE_EDGE * 100) / 100; // round to 2 decimals
}

// Generate mine positions
export function generateMines(mineCount) {
  const positions = new Set();
  while (positions.size < mineCount) {
    positions.add(Math.floor(Math.random() * GRID_SIZE));
  }
  return positions;
}

// Get next multiplier (what you'd get if you reveal one more)
export function getNextMultiplier(revealed, mineCount) {
  return getMultiplier(revealed + 1, mineCount);
}

// Chance of hitting safe tile at current step
export function getSafeChance(revealed, mineCount) {
  const remaining = GRID_SIZE - revealed;
  const safeTiles = remaining - mineCount;
  return safeTiles / remaining;
}

export const MINE_PRESETS = [1, 3, 5, 10, 24];
export { GRID_SIZE };
