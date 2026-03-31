// Monte Carlo RTP simulation for Gates of Olympus — final tuning
// Run: node scripts/gates-rtp-sim.mjs

const GRID_COLS = 6;
const GRID_ROWS = 5;

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

const POOL = [];
for (const sym of SYMBOLS) for (let i = 0; i < sym.weight; i++) POOL.push(sym);
for (let i = 0; i < SCATTER.weight; i++) POOL.push(SCATTER);
function pick() { return POOL[Math.floor(Math.random() * POOL.length)]; }

function generateGrid() {
  const grid = [];
  for (let c = 0; c < GRID_COLS; c++) {
    const col = [];
    for (let r = 0; r < GRID_ROWS; r++) col.push(pick());
    grid.push(col);
  }
  return grid;
}

function evaluateGrid(grid) {
  const counts = {};
  let scatterCount = 0;
  for (let c = 0; c < GRID_COLS; c++) {
    for (let r = 0; r < GRID_ROWS; r++) {
      const sym = grid[c][r];
      if (sym.id === 'scatter') { scatterCount++; continue; }
      if (!counts[sym.id]) counts[sym.id] = { count: 0, positions: [], tier: sym.tier };
      counts[sym.id].count++;
      counts[sym.id].positions.push(`${c}-${r}`);
    }
  }
  const wins = [];
  const winPos = new Set();
  for (const data of Object.values(counts)) {
    if (data.count >= 8) {
      const tierIdx = Math.min(data.count - 8, 4);
      wins.push({ multiplier: CFG.payTable[data.tier][tierIdx] });
      for (const p of data.positions) winPos.add(p);
    }
  }
  return { wins, winPos, scatterCount };
}

function cascadeGrid(grid, winPos) {
  const newGrid = [];
  for (let c = 0; c < GRID_COLS; c++) {
    const remaining = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      if (!winPos.has(`${c}-${r}`)) remaining.push(grid[c][r]);
    }
    const needed = GRID_ROWS - remaining.length;
    for (let i = 0; i < needed; i++) {
      let sym = pick();
      while (sym.id === 'scatter') sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      remaining.unshift(sym);
    }
    newGrid.push(remaining);
  }
  return newGrid;
}

function pickOrb() {
  let r = Math.random() * CFG.orbTotalWeight;
  for (const ov of CFG.orbValues) {
    r -= ov.weight;
    if (r <= 0) return ov.value;
  }
  return 2;
}

function genOrbs() {
  if (Math.random() > CFG.orbChance) return 0;
  return pickOrb(); // always single orb
}

function simulateCascade() {
  const grid = generateGrid();
  const scatterCount = evaluateGrid(grid).scatterCount;
  let currentGrid = grid;
  let baseWin = 0;
  let orbTotal = 0;
  let cascades = 0;
  while (true) {
    const { wins, winPos } = evaluateGrid(currentGrid);
    if (wins.length === 0) break;
    for (const w of wins) baseWin += w.multiplier;
    orbTotal += genOrbs();
    currentGrid = cascadeGrid(currentGrid, winPos);
    cascades++;
    if (cascades > 50) break;
  }
  return { baseWin, orbTotal, scatterCount };
}

let CFG;

function runSim(label, config) {
  CFG = config;
  const N = 2_000_000;
  let totalWon = 0;
  let fsTriggers = 0;

  for (let i = 0; i < N; i++) {
    const { baseWin, orbTotal, scatterCount } = simulateCascade();
    let win = baseWin;
    if (orbTotal > 0 && win > 0) win *= orbTotal;
    const scatPay = config.scatterPay[Math.min(scatterCount, 6)] || 0;
    win += scatPay;
    totalWon += win;

    if (scatterCount >= 4) {
      fsTriggers++;
      let fsSpins = config.fsCount;
      let fsMult = 0;
      while (fsSpins > 0) {
        const fs = simulateCascade();
        let fsWin = fs.baseWin;
        fsMult += fs.orbTotal;
        if (fsMult > 0 && fsWin > 0) fsWin *= fsMult;
        totalWon += fsWin;
        fsSpins--;
        if (fs.scatterCount >= 3) fsSpins += config.fsRetrigger;
      }
    }
  }

  const rtp = (totalWon / N) * 100;
  console.log(`${label}: RTP = ${rtp.toFixed(2)}%  (FS rate: ${(fsTriggers/N*100).toFixed(3)}%)`);
  return rtp;
}

console.log('1M spins per config...\n');

const orbVals = [
  { value: 2,   weight: 50 },
  { value: 3,   weight: 25 },
  { value: 5,   weight: 10 },
  { value: 10,  weight: 3 },
];
const orbTW = orbVals.reduce((s, o) => s + o.weight, 0);

// ~65% base → need ~45% boost → multiply by ~1.45
const payV4 = {
  0: [0.4, 0.8, 1.5, 3, 4.5],
  1: [0.6, 1.2, 2, 4.5, 7],
  2: [0.7, 1.5, 3, 7, 12],
  3: [1, 2, 4.5, 9, 16],
  4: [1.5, 3, 7, 14, 25],
  5: [2, 4.5, 10, 20, 35],
  6: [4, 7, 14, 28, 50],
};

const scatPay = { 4: 1, 5: 2, 6: 25 };

// Final verification: orb=3%, fs=12
runSim(
  'FINAL: orb=3% fs=12',
  { payTable: payV4, scatterPay: scatPay, orbValues: orbVals, orbTotalWeight: orbTW, orbChance: 0.03, fsCount: 12, fsRetrigger: 5 }
);
