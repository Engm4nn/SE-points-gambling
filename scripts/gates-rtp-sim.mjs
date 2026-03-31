// Exact replica of gatesLogic.js for RTP verification
// Run: node scripts/gates-rtp-sim.mjs

const GRID_COLS = 6, GRID_ROWS = 5;

const SYMBOLS = [
  { id: 'crown',     weight: 4,  tier: 6 },
  { id: 'chalice',   weight: 6,  tier: 5 },
  { id: 'ring',      weight: 8,  tier: 4 },
  { id: 'hourglass', weight: 10, tier: 3 },
  { id: 'yellow',    weight: 15, tier: 2 },
  { id: 'blue',      weight: 18, tier: 1 },
  { id: 'red',       weight: 20, tier: 1 },
  { id: 'green',     weight: 22, tier: 0 },
  { id: 'purple',    weight: 25, tier: 0 },
];
const SCATTER = { id: 'scatter', weight: 3 };

// Balanced: feels rewarding but stays at ~95% RTP
const PAY_TABLE = {
  //       8+    9+   10+  11+  12+
  0: [0.4, 0.8, 1.5, 3, 5],
  1: [0.6, 1.2, 2.2, 4.5, 7],
  2: [0.7, 1.5, 3, 7, 12],
  3: [1, 2.2, 4.5, 9, 16],
  4: [1.5, 3, 7, 14, 25],
  5: [2.2, 4.5, 10, 20, 35],
  6: [4.5, 7.5, 15, 30, 50],
};
const MIN_MATCH = 8;
const SCATTER_PAY = { 4: 1, 5: 2, 6: 25 };
const ORB_VALUES = [
  { value: 2,   weight: 50 },
  { value: 3,   weight: 25 },
  { value: 5,   weight: 10 },
  { value: 10,  weight: 3 },
];
const ORB_TOTAL_W = ORB_VALUES.reduce((s, o) => s + o.weight, 0);
const ORB_CHANCE = 0.03;
const FS_COUNT = 12;
const FS_RETRIGGER = 5;

const POOL = [];
for (const sym of SYMBOLS) for (let i = 0; i < sym.weight; i++) POOL.push(sym);
for (let i = 0; i < SCATTER.weight; i++) POOL.push(SCATTER);

function pick() { return POOL[Math.floor(Math.random() * POOL.length)]; }

function genGrid() {
  const g = [];
  for (let c = 0; c < GRID_COLS; c++) {
    const col = [];
    for (let r = 0; r < GRID_ROWS; r++) col.push(pick());
    g.push(col);
  }
  return g;
}

function evalGrid(grid) {
  const counts = {};
  let sc = 0;
  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      const s = grid[c][r];
      if (s.id === 'scatter') { sc++; continue; }
      if (!counts[s.id]) counts[s.id] = { n: 0, pos: [], tier: s.tier };
      counts[s.id].n++;
      counts[s.id].pos.push(`${c}-${r}`);
    }
  }
  const wins = [], wp = new Set();
  for (const d of Object.values(counts)) {
    if (d.n >= MIN_MATCH) {
      const ti = Math.min(d.n - MIN_MATCH, 4);
      wins.push({ mult: PAY_TABLE[d.tier][ti] });
      for (const p of d.pos) wp.add(p);
    }
  }
  return { wins, wp, sc };
}

function cascade(grid, wp) {
  const ng = [];
  for (let c = 0; c < GRID_COLS; c++) {
    const rem = [];
    for (let r = 0; r < GRID_ROWS; r++) if (!wp.has(`${c}-${r}`)) rem.push(grid[c][r]);
    const need = GRID_ROWS - rem.length;
    for (let i = 0; i < need; i++) {
      let s = pick();
      while (s.id === 'scatter') s = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      rem.unshift(s);
    }
    ng.push(rem);
  }
  return ng;
}

function genOrb() {
  if (Math.random() > ORB_CHANCE) return 0;
  let r = Math.random() * ORB_TOTAL_W;
  for (const o of ORB_VALUES) { r -= o.weight; if (r <= 0) return o.value; }
  return 2;
}

// Exactly mirrors simulateFullSpin + settling logic
function simulateSpin(bet) {
  const grid = genGrid();
  let cur = grid, baseWin = 0, orbTotal = 0, cascN = 0;
  let scatters = 0;

  while (true) {
    const { wins, wp, sc } = evalGrid(cur);
    if (cascN === 0) scatters = sc;
    if (wins.length === 0) break;
    let stepWin = 0;
    for (const w of wins) stepWin += w.mult * bet;
    baseWin += Math.floor(stepWin);
    orbTotal += genOrb();
    cur = cascade(cur, wp);
    cascN++;
    if (cascN > 50) break;
  }

  // Settling: apply multiplier (same as component)
  let totalWin = baseWin;
  const effMult = orbTotal > 0 ? orbTotal : 1;
  if (effMult > 1 && totalWin > 0) totalWin = Math.floor(totalWin * effMult);

  // Scatter pay
  const sp = SCATTER_PAY[Math.min(scatters, 6)] || 0;
  if (sp > 0) totalWin += Math.floor(sp * bet);

  return { totalWin, scatters, orbTotal };
}

// Free spin: same but accumulating multiplier
function simulateFreeSpin(bet, incomingMult) {
  const grid = genGrid();
  let cur = grid, baseWin = 0, orbTotal = 0, cascN = 0;
  let scatters = 0;

  while (true) {
    const { wins, wp, sc } = evalGrid(cur);
    if (cascN === 0) scatters = sc;
    if (wins.length === 0) break;
    let stepWin = 0;
    for (const w of wins) stepWin += w.mult * bet;
    baseWin += Math.floor(stepWin);
    orbTotal += genOrb();
    cur = cascade(cur, wp);
    cascN++;
    if (cascN > 50) break;
  }

  // In free spins: orbs from THIS spin add to incoming accumulated mult
  const newAccMult = incomingMult + orbTotal;

  // Apply accumulated multiplier
  let totalWin = baseWin;
  const effMult = newAccMult > 0 ? newAccMult : 1;
  if (effMult > 1 && totalWin > 0) totalWin = Math.floor(totalWin * effMult);

  return { totalWin, scatters, newAccMult };
}

// Main sim
const BET = 100;
const N = 2_000_000;
let totalWagered = 0, totalWon = 0;
let baseWonTotal = 0, fsWonTotal = 0, fsTriggers = 0;
let noWinSpins = 0;

console.log(`Simulating ${N.toLocaleString()} spins at bet=${BET}...\n`);
const t0 = Date.now();

for (let i = 0; i < N; i++) {
  totalWagered += BET;
  const { totalWin, scatters } = simulateSpin(BET);
  totalWon += totalWin;
  baseWonTotal += totalWin;
  if (totalWin === 0) noWinSpins++;

  // Free spins trigger
  if (scatters >= 4) {
    fsTriggers++;
    let spinsLeft = FS_COUNT;
    let accMult = 0;
    let fsTotal = 0;

    while (spinsLeft > 0) {
      const fs = simulateFreeSpin(BET, accMult);
      fsTotal += fs.totalWin;
      accMult = fs.newAccMult;
      spinsLeft--;
      // Retrigger
      if (fs.scatters >= 3) spinsLeft += FS_RETRIGGER;
    }
    totalWon += fsTotal;
    fsWonTotal += fsTotal;
  }
}

const elapsed = (Date.now() - t0) / 1000;
const rtp = (totalWon / totalWagered) * 100;
const baseRtp = (baseWonTotal / totalWagered) * 100;
const fsRtp = (fsWonTotal / totalWagered) * 100;

console.log(`Done in ${elapsed.toFixed(1)}s\n`);
console.log(`Total RTP:      ${rtp.toFixed(2)}%`);
console.log(`  Base game:    ${baseRtp.toFixed(2)}%`);
console.log(`  Free spins:   ${fsRtp.toFixed(2)}%`);
console.log(`  FS trigger:   ${(fsTriggers/N*100).toFixed(3)}% (${fsTriggers} triggers)`);
console.log(`  No-win rate:  ${(noWinSpins/N*100).toFixed(1)}%`);
console.log(`  Avg win/spin: ${(totalWon/N).toFixed(2)} (bet=${BET})`);
