// Plinko drop simulation — 8 rows of pegs, ball bounces left/right

export const ROWS = 8;

// Multipliers tuned for 95% RTP with binomial(8,k)*0.5^8 probabilities
export const RISK_LEVELS = {
  low:    [5.6,  2.1, 1.1, 0.5, 1.15, 0.5, 1.1, 2.1, 5.6],
  medium: [13,   3,   1.3, 0.4, 0.74, 0.4, 1.3, 3,   13],
  high:   [29,   4,   1.5, 0.3, 0.05, 0.3, 1.5, 4,   29],
};

/**
 * Simulate a Plinko ball drop.
 * At each row the ball goes left (0) or right (1) with 50/50 chance.
 * The final slot index equals the count of right-bounces (0–rows).
 * @param {number} rows — number of peg rows (default 8)
 * @returns {{ path: number[], slotIndex: number }}
 */
export function simulateDrop(rows = ROWS) {
  const path = [];
  let slotIndex = 0;

  for (let i = 0; i < rows; i++) {
    const direction = Math.random() < 0.5 ? 0 : 1;
    path.push(direction);
    slotIndex += direction;
  }

  return { path, slotIndex };
}

/**
 * Look up the multiplier for a given slot and risk level.
 * @param {number} slotIndex — 0-based bucket index (0 to rows)
 * @param {'low'|'medium'|'high'} risk
 * @returns {number}
 */
export function getMultiplier(slotIndex, risk) {
  const multipliers = RISK_LEVELS[risk] || RISK_LEVELS.medium;
  return multipliers[slotIndex] ?? 0;
}
