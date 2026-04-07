import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { deductPoints, addPoints, fetchPoints } from '../utils/api';
import { reportSpin } from '../utils/leaderboardApi';
import { MIN_BET, BET_PRESETS } from '../utils/constants';
import { audio } from '../utils/audio';

const MAX_BET = 10000;
const PHASES = { IDLE: 'idle', FLIPPING: 'flipping', RESULT: 'result' };

const CHOICES = [
  { id: 'heads', label: 'HEADS', symbol: 'H' },
  { id: 'tails', label: 'TAILS', symbol: 'T' },
];

function getRotation(result) {
  const spins = 5;
  return result === 'heads' ? spins * 360 : spins * 360 + 180;
}

export default function CoinFlip({ balance, setBalance, username, showToast, addHistory }) {
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [bet, setBet] = useState(50);
  const [customBet, setCustomBet] = useState('');
  const [choice, setChoice] = useState(null);
  const [result, setResult] = useState(null);
  const [won, setWon] = useState(null);
  const [busy, setBusy] = useState(false);
  const [flipKey, setFlipKey] = useState(0);

  const handleCustomBet = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomBet(val);
    const num = parseInt(val, 10);
    if (num >= MIN_BET && num <= MAX_BET) setBet(num);
    else if (num > MAX_BET) setBet(MAX_BET);
  };

  const handlePreset = (amount) => {
    setBet(amount);
    setCustomBet('');
  };

  const handleFlip = useCallback(async () => {
    if (busy) return;
    if (!choice) { showToast('Pick Heads or Tails!', 'error'); return; }
    if (bet < MIN_BET) { showToast('Minimum bet is ' + MIN_BET, 'error'); return; }
    if (bet > MAX_BET) { showToast('Maximum bet is ' + MAX_BET.toLocaleString(), 'error'); return; }
    {
      let currentBalance = balance;
      try {
        const fresh = await fetchPoints(username);
        setBalance(fresh);
        currentBalance = fresh;
      } catch {}
      if (currentBalance < bet) { showToast('Not enough points!', 'error'); return; }
    }

    setBusy(true);
    setBalance((prev) => prev - bet);

    try {
      await deductPoints(username, bet);
    } catch {
      setBalance((prev) => prev + bet);
      setBusy(false);
      showToast('API error — bet refunded', 'error');
      return;
    }

    await audio.ensure();

    const coinResult = Math.random() < 0.5 ? 'heads' : 'tails';
    const didWin = coinResult === choice;

    setResult(coinResult);
    setWon(didWin);
    setPhase(PHASES.FLIPPING);
    setFlipKey((k) => k + 1);
  }, [busy, choice, bet, balance, username, setBalance, showToast]);

  const handleFlipComplete = useCallback(async () => {
    if (!won || !bet) return;

    if (won) {
      const payout = bet * 2;
      try {
        await addPoints(username, payout);
        setBalance((prev) => prev + payout);
      } catch {
        showToast('Failed to add winnings', 'error');
      }
      audio.win(2);
    } else {
      audio.loss();
    }

    try {
      await reportSpin(username, bet, won ? bet * 2 : 0);
    } catch {}

    const emoji = won ? '🪙 ✓' : '🪙 ✗';
    const net = won ? bet : -bet;
    addHistory(
      [{ emoji: `${emoji} ${choice} → ${result}` }],
      net,
      won ? 'win' : 'loss',
      'coinflip',
    );
    showToast(
      won ? `WIN! +${bet.toLocaleString()} pts` : `Landed ${result} — -${bet.toLocaleString()} pts`,
      won ? 'win' : 'error',
    );

    setPhase(PHASES.RESULT);
    setBusy(false);
  }, [won, bet, choice, result, username, setBalance, showToast, addHistory]);

  const handleNewGame = () => {
    setPhase(PHASES.IDLE);
    setResult(null);
    setWon(null);
    setBusy(false);
  };

  const flipping = phase === PHASES.FLIPPING;
  const showResult = phase === PHASES.RESULT;

  return (
    <div style={styles.wrapper}>
      <div style={styles.choiceRow}>
        {CHOICES.map((c) => (
          <button
            key={c.id}
            style={{
              ...styles.choiceBtn,
              ...(choice === c.id ? styles.choiceBtnActive : {}),
            }}
            onClick={() => !busy && setChoice(c.id)}
            disabled={busy}
          >
            <span style={styles.choiceSymbol}>{c.symbol}</span>
            <span style={styles.choiceLabel}>{c.label}</span>
          </button>
        ))}
      </div>

      <div style={styles.coinContainer}>
        <motion.div
          key={flipKey}
          style={styles.coinInner}
          animate={flipping || showResult ? { rotateY: getRotation(result) } : { rotateY: 0 }}
          transition={
            flipping || showResult
              ? { type: 'spring', stiffness: 80, damping: 15, duration: 1.8 }
              : { duration: 0 }
          }
          onAnimationComplete={() => {
            if (flipping) handleFlipComplete();
          }}
        >
          <div style={{ ...styles.coinFace, ...styles.coinFront }}>
            <span style={styles.coinText}>H</span>
          </div>
          <div style={{ ...styles.coinFace, ...styles.coinBack }}>
            <span style={styles.coinText}>T</span>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            style={{
              ...styles.resultOverlay,
              color: won ? 'var(--signal-go)' : 'var(--signal-stop)',
            }}
          >
            {won ? `WIN! +${bet.toLocaleString()}` : `LOSE — -${bet.toLocaleString()}`}
          </motion.div>
        )}
      </AnimatePresence>

      {phase === PHASES.IDLE && (
        <div style={styles.betSection}>
          <div style={styles.betRow}>
            <span style={styles.betLabel}>Bet:</span>
            <div style={styles.betButtons}>
              {BET_PRESETS.map((amount) => (
                <button
                  key={amount}
                  style={{
                    ...styles.betBtn,
                    ...(bet === amount && !customBet ? styles.betBtnActive : {}),
                    ...(amount > MAX_BET ? styles.betBtnDisabled : {}),
                  }}
                  onClick={() => handlePreset(Math.min(amount, MAX_BET))}
                  disabled={amount > balance}
                >
                  {amount.toLocaleString()}
                </button>
              ))}
            </div>
          </div>
          <div style={styles.betRow}>
            <span style={styles.betLabel}>Custom:</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder={bet.toLocaleString()}
              value={customBet}
              onChange={handleCustomBet}
              style={styles.customInput}
              disabled={busy}
            />
          </div>
          <button
            style={{
              ...styles.flipBtn,
              opacity: balance < bet || bet < MIN_BET || bet > MAX_BET || !choice ? 0.4 : 1,
            }}
            onClick={handleFlip}
            disabled={balance < bet || bet < MIN_BET || bet > MAX_BET || busy || !choice}
          >
            FLIP {bet.toLocaleString()}
          </button>
        </div>
      )}

      {showResult && (
        <button style={styles.flipBtn} onClick={handleNewGame}>
          FLIP AGAIN
        </button>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    width: '100%',
    maxWidth: 440,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--sp-4)',
    padding: 'var(--sp-4)',
    fontFamily: "'Chakra Petch', sans-serif",
    color: 'var(--ink)',
  },
  choiceRow: {
    display: 'flex',
    gap: 'var(--sp-3)',
    width: '100%',
    justifyContent: 'center',
  },
  choiceBtn: {
    flex: 1,
    maxWidth: 160,
    padding: 'var(--sp-3) var(--sp-4)',
    borderRadius: 'var(--r-md)',
    border: '2px solid var(--bezel-strong)',
    background: 'var(--panel)',
    color: 'var(--ink-secondary)',
    fontFamily: "'Russo One', sans-serif",
    fontSize: 14,
    letterSpacing: 1,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    transition: 'all var(--t-fast)',
  },
  choiceBtnActive: {
    borderColor: 'var(--discharge)',
    background: 'rgba(255, 204, 0, 0.08)',
    color: 'var(--discharge)',
    boxShadow: '0 0 12px rgba(255, 204, 0, 0.15)',
  },
  choiceSymbol: {
    fontSize: 28,
    lineHeight: 1,
  },
  choiceLabel: {
    fontSize: 11,
    letterSpacing: 2,
  },
  coinContainer: {
    perspective: 800,
    display: 'flex',
    justifyContent: 'center',
    padding: 'var(--sp-4) 0',
  },
  coinInner: {
    width: 150,
    height: 150,
    position: 'relative',
    transformStyle: 'preserve-3d',
  },
  coinFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    backfaceVisibility: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '4px solid #b8860b',
    boxShadow: '0 4px 20px rgba(255, 204, 0, 0.3), inset 0 2px 8px rgba(255, 255, 255, 0.3), inset 0 -2px 8px rgba(0, 0, 0, 0.2)',
  },
  coinFront: {
    background: 'linear-gradient(145deg, #ffd700, #daa520, #f0c040)',
  },
  coinBack: {
    background: 'linear-gradient(145deg, #f0c040, #daa520, #ffd700)',
    transform: 'rotateY(180deg)',
  },
  coinText: {
    fontFamily: "'Russo One', sans-serif",
    fontSize: 52,
    color: '#8b6914',
    textShadow: '1px 1px 0 rgba(255,255,255,0.4), -1px -1px 0 rgba(0,0,0,0.15)',
    userSelect: 'none',
  },
  resultOverlay: {
    textAlign: 'center',
    fontFamily: "'Russo One', sans-serif",
    fontSize: 22,
    padding: 'var(--sp-2) 0',
    letterSpacing: 1,
  },
  betSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--sp-3)',
    width: '100%',
  },
  betRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-2)',
    flexWrap: 'wrap',
  },
  betLabel: {
    fontFamily: "'Russo One', sans-serif",
    fontSize: 12,
    color: 'var(--ink-tertiary)',
    minWidth: 56,
  },
  betButtons: {
    display: 'flex',
    gap: 'var(--sp-1)',
    flexWrap: 'wrap',
  },
  betBtn: {
    padding: '6px 10px',
    borderRadius: 'var(--r-sm)',
    border: '1px solid var(--bezel)',
    background: 'var(--panel)',
    color: 'var(--ink-secondary)',
    fontFamily: "'Chakra Petch', sans-serif",
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
    transition: 'all var(--t-fast)',
  },
  betBtnActive: {
    background: 'var(--phosphor)',
    color: '#fff',
    borderColor: 'var(--phosphor)',
  },
  betBtnDisabled: {
    opacity: 0.35,
    cursor: 'not-allowed',
  },
  customInput: {
    width: 80,
    padding: '6px 8px',
    borderRadius: 'var(--r-sm)',
    border: '1px solid var(--bezel)',
    background: 'var(--inset)',
    color: 'var(--ink)',
    fontFamily: "'Chakra Petch', sans-serif",
    fontSize: 13,
    outline: 'none',
  },
  flipBtn: {
    width: '100%',
    padding: 'var(--sp-3) var(--sp-6)',
    borderRadius: 'var(--r-md)',
    border: 'none',
    background: 'var(--signal-hot)',
    color: '#fff',
    fontFamily: "'Russo One', sans-serif",
    fontSize: 16,
    letterSpacing: 1,
    cursor: 'pointer',
    transition: 'opacity var(--t-fast)',
  },
};
