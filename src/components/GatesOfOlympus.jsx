import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BetControls from './BetControls';
import {
  GRID_COLS, GRID_ROWS, FREE_SPINS_COUNT, FREE_SPINS_RETRIGGER,
  GATES_BONUS_BUY, generateGrid, generateBonusBuyGrid,
  simulateFullSpin, getScatterPay,
} from '../utils/gatesLogic';
import { deductPoints, addPoints } from '../utils/api';
import { audio } from '../utils/audio';
import { sendChatMessage, formatWinMessage, shouldAnnounce } from '../utils/chatBot';
import { reportSpin } from '../utils/leaderboardApi';
import { contributeToJackpot } from '../utils/jackpotApi';
import { JACKPOT_CONTRIBUTION_RATE } from '../utils/constants';
import { Zap, Sparkles, MessageSquare, X } from 'lucide-react';

// Timing (ms)
const TIMING = {
  initialDrop: 600,
  winHighlight: 500,
  symbolPop: 300,
  cascadeFall: 400,
  settleDelay: 800,
};
const TURBO_FACTOR = 0.25;

function t(key, turbo) {
  return turbo ? Math.floor(TIMING[key] * TURBO_FACTOR) : TIMING[key];
}

export default function GatesOfOlympus({ balance, setBalance, username, showToast, addHistory, jackpot, setJackpot }) {
  const [phase, setPhase] = useState('idle');
  // idle | dropping | highlighting | popping | cascading | settling
  const [grid, setGrid] = useState(() => generateGrid());
  const [winPositions, setWinPositions] = useState(new Set());
  const [activeOrbs, setActiveOrbs] = useState([]);
  const [cascadeWin, setCascadeWin] = useState(0);
  const [cascadeMultiplier, setCascadeMultiplier] = useState(0); // sum of orbs this cascade chain
  const [showWin, setShowWin] = useState(null); // { amount, multiplier, shared }

  // Free spins
  const [freeSpins, setFreeSpins] = useState(0);
  const [freeSpinMultiplier, setFreeSpinMultiplier] = useState(0); // accumulated across all spins
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
  const precomputedBaseWinRef = useRef(0);
  const precomputedOrbsRef = useRef(0);
  const autoSpinRef = useRef(false);
  const freeSpinTotalWinRef = useRef(0);

  autoSpinRef.current = autoSpin;

  const busy = phase !== 'idle';
  const canSpin = !busy && !freeSpinIntro && !freeSpinSummary && (isFreeSpinMode ? freeSpins > 0 : balance >= bet);

  // Process one cascade step
  const processStep = useCallback(() => {
    const idx = stepIdxRef.current;
    const steps = stepsRef.current;

    if (idx >= steps.length) {
      // No more cascades — settle
      setGrid(finalGridRef.current);
      setWinPositions(new Set());
      setPhase('settling');
      return;
    }

    const step = steps[idx];

    // Show grid with winning positions highlighted
    setGrid(step.grid);
    setWinPositions(step.winPositions);
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

    // Add step win to cascade total
    setCascadeWin(prev => prev + step.winAmount);
    try { audio.win(step.winAmount > spinBetRef.current * 5 ? 10 : 2); } catch {}
  }, [isFreeSpinMode]);

  // Phase transitions with timeouts
  useEffect(() => {
    if (phase === 'highlighting') {
      const timer = setTimeout(() => {
        setPhase('popping');
      }, t('winHighlight', turbo));
      return () => clearTimeout(timer);
    }

    if (phase === 'popping') {
      const timer = setTimeout(() => {
        setActiveOrbs([]);
        setWinPositions(new Set());
        setPhase('cascading');
      }, t('symbolPop', turbo));
      return () => clearTimeout(timer);
    }

    if (phase === 'cascading') {
      const timer = setTimeout(() => {
        stepIdxRef.current++;
        try { audio.cascadeLand(); } catch {}
        processStep();
      }, t('cascadeFall', turbo));
      return () => clearTimeout(timer);
    }

    if (phase === 'settling') {
      const betAmt = spinBetRef.current;
      let totalWin = precomputedBaseWinRef.current;
      const orbTotal = precomputedOrbsRef.current;

      // Apply multiplier (orbs from this cascade + accumulated free spin multiplier)
      const effectiveMult = isFreeSpinMode ? (freeSpinMultiplier || 1) : (orbTotal > 0 ? orbTotal : 1);
      if (effectiveMult > 1 && totalWin > 0) {
        totalWin = Math.floor(totalWin * effectiveMult);
      }

      // Add scatter pay
      const scatPay = getScatterPay(totalScattersRef.current);
      if (scatPay > 0) {
        totalWin += Math.floor(scatPay * betAmt);
      }

      // Payout
      const mult = betAmt > 0 ? totalWin / betAmt : 0;
      if (totalWin > 0) {
        setBalance(prev => prev + totalWin);
        addPoints(username, totalWin).catch(() => {});

        if (isFreeSpinMode) {
          freeSpinTotalWinRef.current += totalWin;
        }

        const winType = totalWin >= betAmt * 25 ? 'mega' : totalWin >= betAmt * 10 ? 'big' : 'win';
        addHistory([{ emoji: `⚡ Gates ${mult.toFixed(1)}x` }], totalWin - (isFreeSpinMode ? 0 : betAmt), winType, 'gates');

        // Show win screen for 5x+ wins (stays until dismissed)
        if (mult >= 5) {
          setShowWin({ amount: totalWin, multiplier: mult, shared: false });
        } else {
          setShowWin({ amount: totalWin, multiplier: mult, shared: false });
        }
      } else {
        setShowWin(null);
        if (!isFreeSpinMode) {
          const contribution = Math.max(1, Math.floor(betAmt * JACKPOT_CONTRIBUTION_RATE));
          contributeToJackpot(contribution).then(newJp => {
            if (newJp) setJackpot(newJp);
          });
        }
        addHistory([{ emoji: '⚡ Gates 0x' }], isFreeSpinMode ? 0 : -betAmt, 'loss', 'gates');
      }

      if (!isFreeSpinMode) {
        reportSpin(username, betAmt, totalWin);
      }

      // Check free spins trigger
      const scatterCount = totalScattersRef.current;
      const isBigWin = mult >= 5;
      const timer = setTimeout(() => {
        if (isFreeSpinMode) {
          // Retrigger check
          if (scatterCount >= 3) {
            setFreeSpins(prev => prev + FREE_SPINS_RETRIGGER);
            showToast(`+${FREE_SPINS_RETRIGGER} free spins!`, 'bonus');
          }
          setFreeSpins(prev => {
            const next = prev - 1;
            if (next <= 0) {
              // End free spins — show summary with share button
              const totalFsWin = freeSpinTotalWinRef.current;
              setIsFreeSpinMode(false);
              setFreeSpinMultiplier(0);
              setFreeSpinSummary({ totalWin: totalFsWin, bet: betAmt, shared: false });
              reportSpin(username, betAmt, totalFsWin);
            }
            return next;
          });
          setPhase('idle');
          if (!isBigWin) setShowWin(null);
        } else if (scatterCount >= 4) {
          // Trigger free spins
          try { audio.bonus(); } catch {}
          setShowWin(null);
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
          // Small wins auto-dismiss, big wins stay
          if (!isBigWin) {
            setTimeout(() => setShowWin(null), 1500);
          }
        }
      }, t('settleDelay', turbo));
      return () => clearTimeout(timer);
    }
  }, [phase, turbo, freeSpinMultiplier, isFreeSpinMode, username, bet, setBalance, setJackpot, addHistory, showToast, processStep]);

  const handleSpin = useCallback(async (isBonusBuy = false) => {
    if (busy || freeSpinIntro || freeSpinSummary) return;
    await audio.ensure();

    const actualBet = isFreeSpinMode ? 0 : (isBonusBuy ? bet * GATES_BONUS_BUY : bet);

    if (!isFreeSpinMode && balance < actualBet) {
      showToast('Not enough points!', 'error');
      setAutoSpin(false);
      return;
    }

    if (actualBet > 0) {
      setBalance(prev => prev - actualBet);
      try {
        await deductPoints(username, actualBet);
      } catch {
        setBalance(prev => prev + actualBet);
        setAutoSpin(false);
        showToast('API error — bet refunded', 'error');
        return;
      }
    }

    // Reset cascade state
    setCascadeWin(0);
    setCascadeMultiplier(0);
    setShowWin(null);
    setActiveOrbs([]);
    setWinPositions(new Set());
    spinBetRef.current = bet;

    // Generate grid
    const newGrid = isBonusBuy ? generateBonusBuyGrid() : generateGrid();
    setGrid(newGrid);
    setPhase('dropping');

    // Pre-compute cascade chain
    const { steps, finalGrid, totalScatters, totalBaseWin, totalOrbs } = simulateFullSpin(newGrid, bet);
    stepsRef.current = steps;
    finalGridRef.current = finalGrid;
    totalScattersRef.current = totalScatters;
    precomputedBaseWinRef.current = totalBaseWin;
    precomputedOrbsRef.current = totalOrbs;
    stepIdxRef.current = 0;

    // After drop animation, start processing
    setTimeout(() => {
      if (steps.length > 0) {
        try { audio.cascadePop(); } catch {}
        processStep();
      } else {
        // No wins at all
        setPhase('settling');
      }
    }, t('initialDrop', turbo));
  }, [busy, freeSpinIntro, freeSpinSummary, isFreeSpinMode, bet, balance, username, showToast, setBalance, turbo, processStep]);

  const handleBonusBuy = useCallback(() => {
    handleSpin(true);
  }, [handleSpin]);

  const handleShareWin = useCallback(() => {
    if (!showWin || showWin.shared) return;
    const msg = formatWinMessage(username, showWin.amount, showWin.multiplier, showWin.multiplier >= 25 ? 'mega' : 'big', window.location.origin);
    sendChatMessage(msg);
    setShowWin(prev => prev ? { ...prev, shared: true } : null);
    showToast('Shared in chat!', 'info');
  }, [showWin, username, showToast]);

  const handleDismissWin = useCallback(() => {
    setShowWin(null);
  }, []);

  const handleShareFsSummary = useCallback(() => {
    if (!freeSpinSummary || freeSpinSummary.shared) return;
    const mult = freeSpinSummary.bet > 0 ? freeSpinSummary.totalWin / freeSpinSummary.bet : 0;
    const msg = formatWinMessage(username, freeSpinSummary.totalWin, mult, mult >= 25 ? 'mega' : 'big', window.location.origin);
    sendChatMessage(msg);
    setFreeSpinSummary(prev => prev ? { ...prev, shared: true } : null);
    showToast('Shared in chat!', 'info');
  }, [freeSpinSummary, username, showToast]);

  const handleDismissFsSummary = useCallback(() => {
    setFreeSpinSummary(null);
  }, []);

  // Autospin
  useEffect(() => {
    if (!autoSpinRef.current || busy || freeSpinIntro || freeSpinSummary) return;
    const canAuto = isFreeSpinMode ? freeSpins > 0 : balance >= bet;
    if (!canAuto) { setAutoSpin(false); return; }
    const delay = turbo ? 50 : 600;
    const timer = setTimeout(() => {
      if (autoSpinRef.current) handleSpin();
    }, delay);
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

      {/* 6x5 Grid */}
      <div className="gates-grid">
        {grid.map((col, colIdx) => (
          <div key={colIdx} className="gates-column">
            <AnimatePresence mode="popLayout">
              {col.map((sym, rowIdx) => {
                const isWinning = winPositions.has(`${colIdx}-${rowIdx}`);
                const isPopping = isWinning && phase === 'popping';
                return (
                  <motion.div
                    key={sym.instanceId}
                    className={`gates-cell ${isWinning && !isPopping ? 'gates-cell-winning' : ''} ${sym.id === 'scatter' ? 'gates-cell-scatter' : ''}`}
                    initial={{ y: -80, opacity: 0, scale: 0.6 }}
                    animate={isPopping
                      ? { scale: 0, opacity: 0, rotate: 15 }
                      : { y: 0, opacity: 1, scale: 1 }
                    }
                    exit={{ scale: 0, opacity: 0 }}
                    transition={isPopping
                      ? { duration: 0.25 }
                      : { type: 'spring', stiffness: 400, damping: 30, delay: phase === 'dropping' ? colIdx * 0.04 + rowIdx * 0.02 : 0 }
                    }
                  >
                    <span className="gates-symbol">{sym.emoji}</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ))}

        {/* Multiplier orbs overlay */}
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
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0, y: -40 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              {orb.value}x
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Win screen overlay for big wins (5x+) */}
      <AnimatePresence>
        {showWin && showWin.multiplier >= 5 && phase === 'idle' && (
          <motion.div
            className="gates-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="gates-win-screen"
              initial={{ scale: 0.5, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <button className="gates-win-close" onClick={handleDismissWin} aria-label="Close"><X size={16} /></button>
              <div className="gates-win-badge">
                {showWin.multiplier >= 25 ? 'MEGA WIN' : showWin.multiplier >= 10 ? 'BIG WIN' : 'NICE WIN'}
              </div>
              <motion.div
                className="gates-win-amount-big"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              >
                +{showWin.amount.toLocaleString()}
              </motion.div>
              <div className="gates-win-mult">{showWin.multiplier.toFixed(1)}x</div>
              <button
                className={`gates-share-btn ${showWin.shared ? 'gates-share-done' : ''}`}
                onClick={handleShareWin}
                disabled={showWin.shared}
              >
                <MessageSquare size={16} />
                {showWin.shared ? 'Shared!' : 'Share in Chat'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Small win display (below 5x, inline) */}
      <AnimatePresence>
        {showWin && showWin.multiplier < 5 && (
          <motion.div
            className="gates-win-display"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <span className="gates-win-amount">+{showWin.amount.toLocaleString()}</span>
            <span className="gates-win-label">pts</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Free spins intro overlay */}
      <AnimatePresence>
        {freeSpinIntro && (
          <motion.div
            className="gates-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
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

      {/* Free spins summary overlay with share */}
      <AnimatePresence>
        {freeSpinSummary && (
          <motion.div
            className="gates-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="gates-win-screen"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <button className="gates-win-close" onClick={handleDismissFsSummary} aria-label="Close"><X size={16} /></button>
              <Sparkles size={36} className="gates-zeus-icon" />
              <h2 className="gates-overlay-title">FREE SPINS COMPLETE</h2>
              <motion.div
                className="gates-win-amount-big"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              >
                +{freeSpinSummary.totalWin.toLocaleString()}
              </motion.div>
              {freeSpinSummary.bet > 0 && (
                <div className="gates-win-mult">
                  {(freeSpinSummary.totalWin / freeSpinSummary.bet).toFixed(1)}x total
                </div>
              )}
              <button
                className={`gates-share-btn ${freeSpinSummary.shared ? 'gates-share-done' : ''}`}
                onClick={handleShareFsSummary}
                disabled={freeSpinSummary.shared}
              >
                <MessageSquare size={16} />
                {freeSpinSummary.shared ? 'Shared!' : 'Share in Chat'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BetControls
        bet={bet}
        setBet={setBet}
        balance={balance}
        spinning={busy || freeSpinIntro || !!freeSpinSummary}
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
