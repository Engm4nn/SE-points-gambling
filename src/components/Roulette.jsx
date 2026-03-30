import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NUMBERS, spinWheel, evaluateBets, getNumberColor } from '../utils/rouletteLogic';
import { deductPoints, addPoints } from '../utils/api';
import { reportSpin } from '../utils/leaderboardApi';
import { audio } from '../utils/audio';

const CHIP_VALUES = [10, 50, 100, 500, 1000];

const COLOR_HEX = {
  red: '#F43F5E',
  black: '#2D2D5E',
  green: '#34D399',
};

const COLOR_EMOJI = {
  red: '🔴',
  black: '⚫',
  green: '🟢',
};

const GRID_ROWS = Array.from({ length: 12 }, (_, r) => [
  r * 3 + 1,
  r * 3 + 2,
  r * 3 + 3,
]);

export default function Roulette({ balance, setBalance, username, showToast, addHistory }) {
  const [phase, setPhase] = useState('betting');
  const [selectedChip, setSelectedChip] = useState(10);
  const [bets, setBets] = useState([]);
  const [winningNumber, setWinningNumber] = useState(null);
  const [payout, setPayout] = useState(0);
  // Spinning numbers animation
  const [displayNumber, setDisplayNumber] = useState(null);
  const spinIntervalRef = useRef(null);

  const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);

  const placeBet = useCallback((type, value) => {
    if (phase !== 'betting') return;
    if (selectedChip > balance - totalBet) {
      showToast('Not enough points!', 'error');
      return;
    }
    setBets(prev => {
      const idx = prev.findIndex(b => b.type === type && b.value === value);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], amount: updated[idx].amount + selectedChip };
        return updated;
      }
      return [...prev, { type, value, amount: selectedChip }];
    });
  }, [phase, selectedChip, balance, totalBet, showToast]);

  const clearBets = useCallback(() => {
    if (phase !== 'betting') return;
    setBets([]);
  }, [phase]);

  const handleSpin = useCallback(async () => {
    if (phase !== 'betting' || bets.length === 0) return;
    if (totalBet > balance) {
      showToast('Not enough points!', 'error');
      return;
    }
    await audio.ensure();

    setBalance(prev => prev - totalBet);
    setPhase('spinning');

    try {
      await deductPoints(username, totalBet);
    } catch {
      setBalance(prev => prev + totalBet);
      setPhase('betting');
      showToast('API error — bet refunded', 'error');
      return;
    }

    const result = spinWheel();
    setWinningNumber(result);

    // Animated number cycling — fast then slow then stop
    let tick = 0;
    const totalTicks = 30;
    spinIntervalRef.current = setInterval(() => {
      tick++;
      const randomNum = Math.floor(Math.random() * 37);
      setDisplayNumber(randomNum);
      audio.rouletteTick();

      if (tick >= totalTicks) {
        clearInterval(spinIntervalRef.current);
        setDisplayNumber(result);
        audio.rouletteLand();

        setTimeout(async () => {
          const totalPayout = evaluateBets(result, bets);
          setPayout(totalPayout);

          if (totalPayout > 0) {
            setBalance(prev => prev + totalPayout);
            audio.win(totalPayout / totalBet);
            try { await addPoints(username, totalPayout); } catch {}
          } else {
            audio.loss();
          }

          const net = totalPayout - totalBet;
          const color = getNumberColor(result);
          try { await reportSpin(username, totalBet, totalPayout); } catch {}

          addHistory(
            [{ emoji: `${COLOR_EMOJI[color]} ${result}` }],
            net,
            net >= 0 ? 'win' : 'loss',
            'roulette'
          );

          setPhase('result');
        }, 800);
      }
    }, tick < 15 ? 60 : 60 + (tick - 15) * 30); // speeds up then slows down

    // Fallback: use fixed timing with setTimeout chain
    clearInterval(spinIntervalRef.current);
    let delay = 0;
    for (let i = 0; i < totalTicks; i++) {
      const interval = i < 15 ? 60 : 60 + (i - 15) * 30;
      delay += interval;
      const isLast = i === totalTicks - 1;
      setTimeout(() => {
        const num = isLast ? result : Math.floor(Math.random() * 37);
        setDisplayNumber(num);
        audio.rouletteTick();
        if (isLast) {
          audio.rouletteLand();
          setTimeout(async () => {
            const totalPayout = evaluateBets(result, bets);
            setPayout(totalPayout);
            if (totalPayout > 0) {
              setBalance(prev => prev + totalPayout);
              audio.win(totalPayout / totalBet);
              try { await addPoints(username, totalPayout); } catch {}
            } else {
              audio.loss();
            }
            const net = totalPayout - totalBet;
            const color = getNumberColor(result);
            try { await reportSpin(username, totalBet, totalPayout); } catch {}
            addHistory(
              [{ emoji: `${COLOR_EMOJI[color]} ${result}` }],
              net,
              net >= 0 ? 'win' : 'loss',
              'roulette'
            );
            setPhase('result');
          }, 800);
        }
      }, delay);
    }
  }, [phase, bets, totalBet, balance, username, showToast, setBalance, addHistory]);

  const newRound = useCallback(() => {
    setBets([]);
    setWinningNumber(null);
    setPayout(0);
    setDisplayNumber(null);
    setPhase('betting');
  }, []);

  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    };
  }, []);

  const resultColor = winningNumber !== null ? getNumberColor(winningNumber) : null;
  const net = payout - totalBet;
  const displayColor = displayNumber !== null ? getNumberColor(displayNumber) : null;

  return (
    <div className="rl-game">
      {/* Spinning / Result display — big number at top */}
      <AnimatePresence>
        {(phase === 'spinning' || phase === 'result') && (
          <motion.div
            className="rl-display"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <motion.div
              className="rl-big-number"
              style={{ background: displayColor ? COLOR_HEX[displayColor] : 'var(--panel)' }}
              animate={phase === 'spinning' ? { scale: [1, 1.05, 1] } : { scale: 1 }}
              transition={{ repeat: phase === 'spinning' ? Infinity : 0, duration: 0.3 }}
            >
              {displayNumber ?? '?'}
            </motion.div>

            {phase === 'result' && (
              <motion.div
                className="rl-result-text"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <span style={{ color: COLOR_HEX[resultColor] }}>
                  {winningNumber} {resultColor?.toUpperCase()}
                </span>
                <span style={{ color: net >= 0 ? 'var(--signal-go)' : 'var(--signal-stop)' }}>
                  {payout > 0 ? `+${net.toLocaleString()} pts` : 'No win'}
                </span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chip Selector */}
      <div className="rl-chips">
        {CHIP_VALUES.map(v => (
          <button
            key={v}
            className={`rl-chip ${selectedChip === v ? 'rl-chip-active' : ''}`}
            onClick={() => setSelectedChip(v)}
            disabled={phase !== 'betting'}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Zero */}
      <div className="rl-zero-row">
        <button
          className={`rl-num-btn rl-green ${bets.some(b => b.type === 'number' && b.value === 0) ? 'rl-has-bet' : ''} ${phase === 'result' && winningNumber === 0 ? 'rl-winner' : ''}`}
          onClick={() => placeBet('number', 0)}
          disabled={phase !== 'betting'}
        >
          0
        </button>
      </div>

      {/* Number Grid */}
      <div className="rl-grid">
        {GRID_ROWS.flat().map(n => {
          const color = getNumberColor(n);
          const hasBet = bets.some(b => b.type === 'number' && b.value === n);
          const isWinner = phase === 'result' && winningNumber === n;
          return (
            <button
              key={n}
              className={`rl-num-btn ${color === 'red' ? 'rl-red' : 'rl-black'} ${hasBet ? 'rl-has-bet' : ''} ${isWinner ? 'rl-winner' : ''}`}
              onClick={() => placeBet('number', n)}
              disabled={phase !== 'betting'}
            >
              {n}
            </button>
          );
        })}
      </div>

      {/* Outside Bets */}
      <div className="rl-outside">
        {[
          { label: 'Red', type: 'red', cls: 'rl-out-red' },
          { label: 'Black', type: 'black', cls: 'rl-out-black' },
          { label: 'Odd', type: 'odd', cls: '' },
          { label: 'Even', type: 'even', cls: '' },
          { label: '1-18', type: 'low', cls: '' },
          { label: '19-36', type: 'high', cls: '' },
        ].map(({ label, type, cls }) => {
          const hasBet = bets.some(b => b.type === type);
          return (
            <button
              key={type}
              className={`rl-out-btn ${cls} ${hasBet ? 'rl-has-bet' : ''}`}
              onClick={() => placeBet(type, undefined)}
              disabled={phase !== 'betting'}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Bets summary */}
      {bets.length > 0 && (
        <div className="rl-bets-summary">
          {bets.map((b, i) => (
            <div key={i} className="rl-bet-line">
              <span>{b.type === 'number' ? `#${b.value}` : b.type}</span>
              <span className="rl-bet-amount">{b.amount}</span>
            </div>
          ))}
          <div className="rl-bet-total">
            <span>Total</span>
            <span>{totalBet.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="rl-actions">
        {phase === 'betting' && (
          <>
            <button className="rl-clear-btn" onClick={clearBets} disabled={bets.length === 0}>Clear</button>
            <button className="spin-btn" onClick={handleSpin} disabled={bets.length === 0 || totalBet > balance}>
              SPIN ({totalBet.toLocaleString()})
            </button>
          </>
        )}
        {phase === 'spinning' && (
          <div className="rl-spinning-label">Spinning...</div>
        )}
        {phase === 'result' && (
          <button className="spin-btn" onClick={newRound}>NEW ROUND</button>
        )}
      </div>
    </div>
  );
}
