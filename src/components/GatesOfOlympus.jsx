import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BetControls from './BetControls';
import {
  GRID_COLS, GRID_ROWS, FREE_SPINS_COUNT, FREE_SPINS_RETRIGGER,
  GATES_BONUS_BUY, generateGrid, generateBonusBuyGrid,
  simulateFullSpin, getScatterPay,
} from '../utils/gatesLogic';
import { deductPoints, addPoints, fetchPoints } from '../utils/api';
import { audio } from '../utils/audio';
import { reportSpin } from '../utils/leaderboardApi';
import { contributeToJackpot } from '../utils/jackpotApi';
import { JACKPOT_CONTRIBUTION_RATE } from '../utils/constants';
import WinShareOverlay from './WinShareOverlay';
import { Zap, Sparkles } from 'lucide-react';

// Timing (ms) — normal and turbo
const TIMING = {
  initialDrop: [700, 250],
  winHighlight: [600, 200],
  symbolPop: [350, 150],
  cascadeFall: [450, 200],
  settleDelay: [600, 150],
};

function t(key, turbo) {
  return turbo ? TIMING[key][1] : TIMING[key][0];
}

export default function GatesOfOlympus({ balance, setBalance, username, showToast, addHistory, jackpot, setJackpot }) {
  const [phase, setPhase] = useState('idle');
  // idle | dropping | highlighting | popping | cascading | settling
  const [grid, setGrid] = useState(() => generateGrid());
  const [winPositions, setWinPositions] = useState(new Set());
  const [newCells, setNewCells] = useState(new Set()); // cells that just dropped in
  const [scatterPositions, setScatterPositions] = useState(new Set()); // scatter cells to highlight
  const [scatterCount, setScatterCount] = useState(0);
  const [activeOrbs, setActiveOrbs] = useState([]);
  const [cascadeWin, setCascadeWin] = useState(0);
  const [cascadeMultiplier, setCascadeMultiplier] = useState(0);
  const [showWin, setShowWin] = useState(null); // small inline display
  const [shareWin, setShareWin] = useState(null); // big win overlay

  // Free spins
  const [freeSpins, setFreeSpins] = useState(0);
  const [freeSpinMultiplier, setFreeSpinMultiplier] = useState(0);
  const [isFreeSpinMode, setIsFreeSpinMode] = useState(false);
  const [freeSpinIntro, setFreeSpinIntro] = useState(false);
  const [freeSpinSummary, setFreeSpinSummary] = useState(null);

  // Bet
  const [bet, setBet] = useState(10);
  const [autoSpin, setAutoSpin] = useState(false);
  const [turbo, setTurbo] = useState(false);

  const stepsRef = useRef([]);
  const stepIdxRef = useRef(0);
  const finalGridRef = useRef(null);
  const totalScattersRef = useRef(0);
  const spinBetRef = useRef(0);
  const baseBetRef = useRef(0);
  const precomputedBaseWinRef = useRef(0);
  const precomputedOrbsRef = useRef(0);
  const autoSpinRef = useRef(false);
  const freeSpinTotalWinRef = useRef(0);
  const betIdRef = useRef(null);

  autoSpinRef.current = autoSpin;

  const busy = phase !== 'idle';
  const canSpin = !busy && !freeSpinIntro && !freeSpinSummary && (isFreeSpinMode ? freeSpins > 0 : balance >= bet);

  // Process one cascade step
  const processStep = useCallback(() => {
    const idx = stepIdxRef.current;
    const steps = stepsRef.current;

    if (idx >= steps.length) {
      // No more cascades — show final grid and settle
      setGrid(finalGridRef.current);
      setWinPositions(new Set());
      setNewCells(new Set());
      setPhase('settling');
      return;
    }

    const step = steps[idx];

    // Show grid with winning positions highlighted
    setGrid(step.grid);
    setWinPositions(step.winPositions);
    setNewCells(new Set());
    setPhase('highlighting');

    // Collect orbs
    if (step.orbs.length > 0) {
      setActiveOrbs(step.orbs);
      for (const orb of step.orbs) {
        if (isFreeSpinMode) {
          setFreeSpinMultiplier(prev => prev + orb.value);
        } else {
          setCascadeMultiplier(prev => prev + orb.value);
        }
      }
      try { audio.orbCollect(); } catch {}
    }

    setCascadeWin(prev => prev + step.winAmount);
    try { audio.win(step.winAmount > spinBetRef.current * 5 ? 10 : 2); } catch {}
  }, [isFreeSpinMode]);

  // Phase transitions
  useEffect(() => {
    if (phase === 'highlighting') {
      const timer = setTimeout(() => {
        setPhase('popping');
        try { audio.cascadePop(); } catch {}
      }, t('winHighlight', turbo));
      return () => clearTimeout(timer);
    }

    if (phase === 'popping') {
      const timer = setTimeout(() => {
        // After pop: swap to cascaded grid with new symbols dropping in
        const currentWinPos = stepsRef.current[stepIdxRef.current]?.winPositions;
        const nextIdx = stepIdxRef.current + 1;
        const nextGrid = nextIdx < stepsRef.current.length
          ? stepsRef.current[nextIdx].grid
          : finalGridRef.current;

        // Mark new cells (top N rows of each column where wins were removed)
        const incoming = new Set();
        if (currentWinPos) {
          for (let c = 0; c < GRID_COLS; c++) {
            let count = 0;
            for (let r = 0; r < GRID_ROWS; r++) {
              if (currentWinPos.has(`${c}-${r}`)) count++;
            }
            for (let r = 0; r < count; r++) {
              incoming.add(`${c}-${r}`);
            }
          }
        }

        // Load the new grid, clear win highlights, show drop animation
        setGrid(nextGrid);
        setNewCells(incoming);
        setActiveOrbs([]);
        setWinPositions(new Set());
        setPhase('cascading');
      }, t('symbolPop', turbo));
      return () => clearTimeout(timer);
    }

    if (phase === 'cascading') {
      const timer = setTimeout(() => {
        setNewCells(new Set());
        stepIdxRef.current++;
        try { audio.cascadeLand(); } catch {}
        processStep();
      }, t('cascadeFall', turbo));
      return () => clearTimeout(timer);
    }

    if (phase === 'settling') {
      const betAmt = spinBetRef.current;
      const baseBet = baseBetRef.current;
      let totalWin = precomputedBaseWinRef.current;
      const orbTotal = precomputedOrbsRef.current;

      const effectiveMult = isFreeSpinMode ? (freeSpinMultiplier || 1) : (orbTotal > 0 ? orbTotal : 1);
      if (effectiveMult > 1 && totalWin > 0) {
        totalWin = Math.floor(totalWin * effectiveMult);
      }

      const scatPay = getScatterPay(totalScattersRef.current);
      if (scatPay > 0) {
        totalWin += Math.floor(scatPay * baseBet);
      }

      const mult = baseBet > 0 ? totalWin / baseBet : 0;
      if (totalWin > 0) {
        setBalance(prev => prev + totalWin);
        addPoints(username, totalWin, 'gates', betIdRef.current).catch(() => {});
        if (isFreeSpinMode) freeSpinTotalWinRef.current += totalWin;
        const winType = totalWin >= baseBet * 25 ? 'mega' : totalWin >= baseBet * 10 ? 'big' : 'win';
        addHistory([{ emoji: `⚡ Gates ${Math.floor(mult)}x` }], totalWin - (isFreeSpinMode ? 0 : betAmt), winType, 'gates');
        // Big wins (5x+) get share overlay, but not during free spins (wait for summary)
        if (!isFreeSpinMode && mult >= 5) {
          setShareWin({ amount: totalWin, multiplier: mult });
        }
        setShowWin({ amount: totalWin, multiplier: mult });
      } else {
        setShowWin(null);
        if (!isFreeSpinMode) {
          const contribution = Math.max(1, Math.floor(baseBet * JACKPOT_CONTRIBUTION_RATE));
          contributeToJackpot(contribution).then(newJp => { if (newJp) setJackpot(newJp); });
        }
        addHistory([{ emoji: '⚡ Gates 0x' }], isFreeSpinMode ? 0 : -betAmt, 'loss', 'gates');
      }

      if (!isFreeSpinMode) reportSpin(username, betAmt, totalWin);

      const scatterCount = totalScattersRef.current;
      const isBigWin = mult >= 5;
      const timer = setTimeout(() => {
        if (isFreeSpinMode) {
          if (scatterCount >= 3) {
            setFreeSpins(prev => prev + FREE_SPINS_RETRIGGER);
            showToast(`+${FREE_SPINS_RETRIGGER} free spins!`, 'bonus');
          }
          setFreeSpins(prev => {
            const next = prev - 1;
            if (next <= 0) {
              const totalFsWin = freeSpinTotalWinRef.current;
              setIsFreeSpinMode(false);
              setFreeSpinMultiplier(0);
              const fsMult = baseBet > 0 ? totalFsWin / baseBet : 0;
              setFreeSpinSummary({ totalWin: totalFsWin, bet: baseBet });
              if (totalFsWin > 0) setShareWin({ amount: totalFsWin, multiplier: fsMult });
              reportSpin(username, betAmt, totalFsWin);
            }
            return next;
          });
          setPhase('idle');
          if (!isBigWin) setShowWin(null);
        } else if (scatterCount >= 4) {
          try { audio.bonus(); } catch {}
          setShowWin(null);
          setScatterPositions(new Set());
          setScatterCount(0);
          setFreeSpinIntro(true);
          setTimeout(() => {
            setFreeSpinIntro(false);
            setIsFreeSpinMode(true);
            setFreeSpins(FREE_SPINS_COUNT);
            setFreeSpinMultiplier(0);
            freeSpinTotalWinRef.current = 0;
            showToast(`${FREE_SPINS_COUNT} Free Spins!`, 'bonus');
            setPhase('idle');
          }, 2500);
        } else {
          setPhase('idle');
          if (!isBigWin) setTimeout(() => setShowWin(null), 1500);
        }
      }, t('settleDelay', turbo));
      return () => clearTimeout(timer);
    }
  }, [phase, turbo, freeSpinMultiplier, isFreeSpinMode, username, bet, setBalance, setJackpot, addHistory, showToast, processStep]);

  const handleSpin = useCallback(async (isBonusBuy = false) => {
    if (busy || freeSpinIntro || freeSpinSummary) return;
    await audio.ensure();

    const actualBet = isFreeSpinMode ? 0 : (isBonusBuy ? bet * GATES_BONUS_BUY : bet);

    if (!isFreeSpinMode) {
      let currentBalance = balance;
      try {
        const fresh = await fetchPoints(username);
        setBalance(fresh);
        currentBalance = fresh;
      } catch {}
      if (currentBalance < actualBet) {
        showToast('Not enough points!', 'error');
        setAutoSpin(false);
        return;
      }
    }

    if (actualBet > 0) {
      setBalance(prev => prev - actualBet);
      try {
        const deductResult = await deductPoints(username, actualBet, 'gates');
        betIdRef.current = deductResult.betId;
      } catch {
        setBalance(prev => prev + actualBet);
        setAutoSpin(false);
        showToast('API error — bet refunded', 'error');
        return;
      }
    }

    setCascadeWin(0);
    setCascadeMultiplier(0);
    setShowWin(null);
    setShareWin(null);
    setActiveOrbs([]);
    setWinPositions(new Set());
    setScatterPositions(new Set());
    setScatterCount(0);
    spinBetRef.current = actualBet;
    baseBetRef.current = bet;

    const newGrid = isBonusBuy ? generateBonusBuyGrid() : generateGrid();

    // Mark ALL cells as new for the initial drop
    const allNew = new Set();
    for (let c = 0; c < GRID_COLS; c++) {
      for (let r = 0; r < GRID_ROWS; r++) {
        allNew.add(`${c}-${r}`);
      }
    }
    setNewCells(allNew);
    setGrid(newGrid);
    setPhase('dropping');

    const { steps, finalGrid, totalScatters, totalBaseWin, totalOrbs } = simulateFullSpin(newGrid, bet, isFreeSpinMode);
    stepsRef.current = steps;
    finalGridRef.current = finalGrid;
    totalScattersRef.current = totalScatters;
    precomputedBaseWinRef.current = totalBaseWin;
    precomputedOrbsRef.current = totalOrbs;
    stepIdxRef.current = 0;

    // After drop: highlight scatters with staggered thunder sounds
    const dropTime = t('initialDrop', turbo);
    if (totalScatters > 0) {
      // Find scatter positions in the grid
      const scatPos = new Set();
      for (let c = 0; c < GRID_COLS; c++) {
        for (let r = 0; r < GRID_ROWS; r++) {
          if (newGrid[c][r].id === 'scatter') scatPos.add(`${c}-${r}`);
        }
      }

      // Stagger thunder sounds — one per scatter, building tension
      const scatArr = [...scatPos];
      scatArr.forEach((_, i) => {
        setTimeout(() => {
          try { audio.thunder(i + 1, totalScatters); } catch {}
        }, dropTime + i * 350);
      });

      // Show scatter highlights after drop
      setTimeout(() => {
        setScatterPositions(scatPos);
        setScatterCount(totalScatters);
      }, dropTime);

      // Hold the scatter display, then continue to cascade
      const scatterHoldTime = totalScatters * 350 + 400;
      setTimeout(() => {
        setNewCells(new Set());
        if (totalScatters >= 4) {
          // Don't clear scatter highlights yet — they'll clear when free spins trigger
        } else {
          setScatterPositions(new Set());
          setScatterCount(0);
        }
        if (steps.length > 0) {
          processStep();
        } else {
          setPhase('settling');
        }
      }, dropTime + scatterHoldTime);
    } else {
      setTimeout(() => {
        setNewCells(new Set());
        if (steps.length > 0) {
          processStep();
        } else {
          setPhase('settling');
        }
      }, t('initialDrop', turbo));
    }
  }, [busy, freeSpinIntro, freeSpinSummary, isFreeSpinMode, bet, balance, username, showToast, setBalance, turbo, processStep]);

  const handleBonusBuy = useCallback(() => { handleSpin(true); }, [handleSpin]);

  const handleDismissShare = useCallback(() => {
    setShareWin(null);
    setFreeSpinSummary(null);
  }, []);

  // Autospin
  useEffect(() => {
    if (!autoSpinRef.current || busy || freeSpinIntro || freeSpinSummary) return;
    const canAuto = isFreeSpinMode ? freeSpins > 0 : balance >= bet;
    if (!canAuto) { setAutoSpin(false); return; }
    const delay = turbo ? 50 : 600;
    const timer = setTimeout(() => { if (autoSpinRef.current) handleSpin(); }, delay);
    return () => clearTimeout(timer);
  }, [phase, autoSpin, busy, freeSpinIntro, freeSpinSummary, isFreeSpinMode, freeSpins, balance, bet, turbo, handleSpin]);

  // Keyboard
  useEffect(() => {
    const handler = (e) => {
      if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        if (canSpin) handleSpin();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canSpin, handleSpin]);

  return (
    <div className="gates-game">
      {/* Multiplier / Free Spins bar */}
      <div className="gates-status-lane gates-status-lane-top">
        <div className="gates-info-bar">
          {isFreeSpinMode && (
            <div className="gates-freespin-bar">
              <Zap size={14} />
              <span>FREE SPINS: {freeSpins}</span>
              <span className="gates-fs-mult">MULT: {freeSpinMultiplier > 0 ? `${freeSpinMultiplier}x` : '—'}</span>
            </div>
          )}
          {cascadeWin > 0 && phase !== 'idle' && (
            <div className="gates-cascade-win">
              CASCADE WIN: {cascadeWin.toLocaleString()}
              {cascadeMultiplier > 0 && !isFreeSpinMode && ` × ${cascadeMultiplier}x`}
              {isFreeSpinMode && freeSpinMultiplier > 0 && ` × ${freeSpinMultiplier}x`}
            </div>
          )}
        </div>
      </div>

      {/* Scatter counter */}
      <div className="gates-status-lane gates-status-lane-scatter">
        {scatterCount > 0 && (
          <div className={`gates-scatter-counter ${scatterCount >= 4 ? 'gates-scatter-trigger' : scatterCount >= 3 ? 'gates-scatter-hype' : ''}`}>
            <Zap size={16} />
            <span>SCATTER ×{scatterCount}</span>
            {scatterCount >= 4 && <span className="gates-scatter-go">FREE SPINS!</span>}
            {scatterCount === 3 && <span className="gates-scatter-close">SO CLOSE!</span>}
          </div>
        )}
      </div>

      {/* 6×5 Grid — CSS-driven animations */}
      <div className={`gates-grid ${phase === 'dropping' ? 'gates-grid-dropping' : ''}`}>
        {grid.map((col, c) => (
          <div key={c} className="gates-column">
            {col.map((sym, r) => {
              const key = `${c}-${r}`;
              const isWin = winPositions.has(key);
              const isPop = isWin && phase === 'popping';
              const isNew = newCells.has(key);
              const isScatterHit = scatterPositions.has(key);
              let cls = 'gates-cell';
              if (isWin && !isPop) cls += ' gates-cell-win';
              if (isPop) cls += ' gates-cell-pop';
              if (isNew && (phase === 'dropping' || phase === 'cascading')) cls += ' gates-cell-drop';
              if (sym.id === 'scatter') cls += ' gates-cell-scatter';
              if (isScatterHit) cls += ` gates-cell-scatter-hit gates-scatter-level-${Math.min(scatterCount, 4)}`;
              return (
                <div
                  key={sym.instanceId}
                  className={cls}
                  style={isNew ? { animationDelay: `${c * 40 + r * 25}ms` } : undefined}
                >
                  <span className="gates-symbol">{sym.emoji}</span>
                </div>
              );
            })}
          </div>
        ))}

        {/* Multiplier orbs */}
        <AnimatePresence>
          {activeOrbs.map(orb => (
            <motion.div
              key={orb.id}
              className="gates-orb"
              style={{
                left: `${(orb.col + 0.5) * (100 / GRID_COLS)}%`,
                top: `${(orb.row + 0.5) * (100 / GRID_ROWS)}%`,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.3, 1], opacity: 1 }}
              exit={{ scale: 0, opacity: 0, y: -30 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              {orb.value}x
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Small win display (inline, below 5x) */}
      <div className="gates-status-lane gates-status-lane-win">
        <AnimatePresence>
          {showWin && showWin.multiplier < 5 && (
            <motion.div
              className="gates-win-display"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
            >
              <span className="gates-win-amount">+{showWin.amount.toLocaleString()}</span>
              <span className="gates-win-label">pts</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Free spins intro */}
      <AnimatePresence>
        {freeSpinIntro && (
          <motion.div className="gates-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              className="gates-overlay-content"
              initial={{ scale: 0.5, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <Zap size={48} className="gates-zeus-icon" />
              <h2 className="gates-overlay-title">FREE SPINS</h2>
              <p className="gates-overlay-sub">{FREE_SPINS_COUNT} spins — multipliers accumulate!</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Win share overlay (big wins + free spin summary) */}
      <AnimatePresence>
        {shareWin && (
          <WinShareOverlay
            amount={shareWin.amount}
            multiplier={shareWin.multiplier}
            username={username}
            game={freeSpinSummary ? 'Gates — Free Spins' : 'Gates of Olympus'}
            onDismiss={handleDismissShare}
          />
        )}
      </AnimatePresence>

      <BetControls
        bet={bet}
        setBet={setBet}
        balance={balance}
        spinning={busy || freeSpinIntro || !!freeSpinSummary || !!shareWin}
        onSpin={() => handleSpin(false)}
        onBonusBuy={handleBonusBuy}
        bonusMode={isFreeSpinMode}
        autoSpin={autoSpin}
        onAutoSpinToggle={() => setAutoSpin(prev => !prev)}
        turbo={turbo}
        onTurboToggle={() => setTurbo(prev => !prev)}
        bonusBuyMultiplier={GATES_BONUS_BUY}
      />
    </div>
  );
}
