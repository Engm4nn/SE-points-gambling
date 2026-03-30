import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { deductPoints, addPoints } from '../utils/api';
import { reportSpin } from '../utils/leaderboardApi';
import { generateMines, getMultiplier, getNextMultiplier, getSafeChance, MINE_PRESETS, GRID_SIZE } from '../utils/minesLogic';
import { MIN_BET, BET_PRESETS } from '../utils/constants';
import { audio } from '../utils/audio';
import { Bomb, Diamond, DollarSign } from 'lucide-react';

const PHASES = { SETUP: 'setup', PLAYING: 'playing', RESULT: 'result' };

export default function Mines({ balance, setBalance, username, showToast, addHistory }) {
  const [phase, setPhase] = useState(PHASES.SETUP);
  const [bet, setBet] = useState(10);
  const [customBet, setCustomBet] = useState('');
  const [mineCount, setMineCount] = useState(3);
  const [mines, setMines] = useState(new Set());
  const [revealed, setRevealed] = useState(new Set());
  const [hitMine, setHitMine] = useState(null);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const betRef = useRef(10);

  const handleStart = useCallback(async () => {
    if (balance < bet || bet < MIN_BET) return;
    await audio.ensure();

    betRef.current = bet;
    setBalance(prev => prev - bet);

    try {
      await deductPoints(username, bet);
    } catch {
      setBalance(prev => prev + bet);
      showToast('API error — bet refunded', 'error');
      return;
    }

    const minePositions = generateMines(mineCount);
    setMines(minePositions);
    setRevealed(new Set());
    setHitMine(null);
    setCurrentMultiplier(1);
    setPhase(PHASES.PLAYING);
  }, [balance, bet, mineCount, username, setBalance, showToast]);

  const handleReveal = useCallback((index) => {
    if (phase !== PHASES.PLAYING || revealed.has(index)) return;

    if (mines.has(index)) {
      // Hit a mine — lose everything
      setHitMine(index);
      setPhase(PHASES.RESULT);
      audio.loss();
      reportSpin(username, betRef.current, 0);
      addHistory(
        [{ emoji: `💣 ${revealed.size}/${GRID_SIZE - mineCount} safe` }],
        -betRef.current,
        'loss',
        'mines'
      );
      showToast(`BOOM! Lost ${betRef.current.toLocaleString()} pts`, 'error');
    } else {
      // Safe tile
      const newRevealed = new Set(revealed);
      newRevealed.add(index);
      setRevealed(newRevealed);

      const mult = getMultiplier(newRevealed.size, mineCount);
      setCurrentMultiplier(mult);
      audio.cardDeal();

      // Auto-win if all safe tiles revealed
      if (newRevealed.size === GRID_SIZE - mineCount) {
        const payout = Math.floor(betRef.current * mult);
        setBalance(prev => prev + payout);
        addPoints(username, payout).catch(() => {});
        setPhase(PHASES.RESULT);
        audio.win(mult);
        reportSpin(username, betRef.current, payout);
        addHistory(
          [{ emoji: `💎 ALL SAFE ${mult}x` }],
          payout - betRef.current,
          'win',
          'mines'
        );
        showToast(`ALL CLEAR! +${(payout - betRef.current).toLocaleString()} pts (${mult}x)`, 'win');
      }
    }
  }, [phase, revealed, mines, mineCount, username, setBalance, showToast, addHistory]);

  const handleCashout = useCallback(() => {
    if (phase !== PHASES.PLAYING || revealed.size === 0) return;

    const payout = Math.floor(betRef.current * currentMultiplier);
    setBalance(prev => prev + payout);
    addPoints(username, payout).catch(() => {});
    setPhase(PHASES.RESULT);
    audio.win(currentMultiplier);
    reportSpin(username, betRef.current, payout);
    addHistory(
      [{ emoji: `💎 ${currentMultiplier}x (${revealed.size} tiles)` }],
      payout - betRef.current,
      'win',
      'mines'
    );
    showToast(`Cashed out ${currentMultiplier}x — +${(payout - betRef.current).toLocaleString()} pts`, 'win');
  }, [phase, revealed, currentMultiplier, username, setBalance, showToast, addHistory]);

  const handleNewGame = useCallback(() => {
    setPhase(PHASES.SETUP);
    setMines(new Set());
    setRevealed(new Set());
    setHitMine(null);
    setCurrentMultiplier(1);
  }, []);

  const handleCustomBet = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomBet(val);
    const num = parseInt(val, 10);
    if (num >= MIN_BET) setBet(num);
  };

  const nextMult = phase === PHASES.PLAYING ? getNextMultiplier(revealed.size, mineCount) : null;
  const safeChance = phase === PHASES.PLAYING ? getSafeChance(revealed.size, mineCount) : null;

  return (
    <div className="mines-game">
      {/* Setup controls */}
      {phase === PHASES.SETUP && (
        <div className="mn-setup">
          <div className="mn-row">
            <span className="mn-label">Mines:</span>
            <div className="mn-mine-btns">
              {MINE_PRESETS.map(m => (
                <button
                  key={m}
                  className={`bet-btn ${mineCount === m ? 'active' : ''}`}
                  onClick={() => setMineCount(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="mn-row">
            <span className="mn-label">Bet:</span>
            <div className="mn-mine-btns">
              {BET_PRESETS.map(amount => (
                <button
                  key={amount}
                  className={`bet-btn ${bet === amount && !customBet ? 'active' : ''}`}
                  onClick={() => { setBet(amount); setCustomBet(''); }}
                  disabled={amount > balance}
                >
                  {amount.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
          <div className="mn-row">
            <span className="mn-label">Custom:</span>
            <input
              type="text"
              inputMode="numeric"
              className="bet-custom-input"
              placeholder={bet.toLocaleString()}
              value={customBet}
              onChange={handleCustomBet}
            />
          </div>
          <button
            className="spin-btn"
            onClick={handleStart}
            disabled={balance < bet || bet < MIN_BET}
          >
            START ({bet.toLocaleString()})
          </button>
        </div>
      )}

      {/* Game info bar */}
      {phase === PHASES.PLAYING && (
        <div className="mn-info-bar">
          <div className="mn-stat">
            <span className="mn-stat-label">Multiplier</span>
            <span className="mn-stat-value mn-mult">{currentMultiplier}x</span>
          </div>
          <div className="mn-stat">
            <span className="mn-stat-label">Next</span>
            <span className="mn-stat-value">{nextMult}x</span>
          </div>
          <div className="mn-stat">
            <span className="mn-stat-label">Safe</span>
            <span className="mn-stat-value">{Math.round(safeChance * 100)}%</span>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="mn-grid">
        {Array.from({ length: GRID_SIZE }, (_, i) => {
          const isRevealed = revealed.has(i);
          const isMine = mines.has(i);
          const isHit = hitMine === i;
          const showMine = phase === PHASES.RESULT && isMine;

          let tileClass = 'mn-tile';
          if (isRevealed) tileClass += ' mn-safe';
          if (isHit) tileClass += ' mn-hit';
          else if (showMine) tileClass += ' mn-mine-reveal';
          const clickable = phase === PHASES.PLAYING && !isRevealed;

          return (
            <motion.button
              key={i}
              className={tileClass}
              onClick={() => clickable && handleReveal(i)}
              disabled={!clickable}
              whileTap={clickable ? { scale: 0.9 } : {}}
            >
              {isHit && <Bomb size={18} />}
              {showMine && !isHit && <Bomb size={14} style={{ opacity: 0.5 }} />}
              {isRevealed && !isMine && <Diamond size={16} />}
            </motion.button>
          );
        })}
      </div>

      {/* Cashout / Result */}
      {phase === PHASES.PLAYING && revealed.size > 0 && (
        <button className="mn-cashout-btn" onClick={handleCashout}>
          <DollarSign size={18} />
          CASH OUT {Math.floor(betRef.current * currentMultiplier).toLocaleString()} pts ({currentMultiplier}x)
        </button>
      )}

      {phase === PHASES.RESULT && (
        <button className="spin-btn" onClick={handleNewGame}>
          NEW GAME
        </button>
      )}
    </div>
  );
}
