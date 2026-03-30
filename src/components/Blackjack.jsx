import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createDeck, handValue, isBlackjack, dealerShouldHit } from '../utils/blackjackLogic';
import { deductPoints, addPoints } from '../utils/api';
import { reportSpin } from '../utils/leaderboardApi';
import { BET_PRESETS, MIN_BET } from '../utils/constants';
import { audio } from '../utils/audio';

// ── Phases ──────────────────────────────────────────────
// betting → playing → dealerTurn → result
const PHASE = { BETTING: 'betting', PLAYING: 'playing', DEALER: 'dealerTurn', RESULT: 'result' };

// ── Helpers ─────────────────────────────────────────────
const isRed = (card) => card.suit === '♥' || card.suit === '♦';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Card component ──────────────────────────────────────
function Card({ card, hidden, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.12 }}
      style={{
        width: 48,
        height: 68,
        borderRadius: 'var(--r-md)',
        border: '1.5px solid var(--bezel-strong)',
        background: hidden ? 'var(--panel)' : '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Chakra Petch', sans-serif",
        fontWeight: 700,
        fontSize: 14,
        color: hidden ? 'var(--ink-tertiary)' : isRed(card) ? '#dc2626' : '#1e1e2e',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {hidden ? '?' : card.display}
    </motion.div>
  );
}

// ── Main component ──────────────────────────────────────
export default function Blackjack({ balance, setBalance, username, showToast, addHistory }) {
  const [phase, setPhase] = useState(PHASE.BETTING);
  const [bet, setBet] = useState(MIN_BET);
  const [customBet, setCustomBet] = useState('');
  const [playerCards, setPlayerCards] = useState([]);
  const [dealerCards, setDealerCards] = useState([]);
  const [dealerHidden, setDealerHidden] = useState(true);
  const [resultText, setResultText] = useState('');
  const [resultNet, setResultNet] = useState(0);
  const [busy, setBusy] = useState(false);

  const deckRef = useRef([]);

  // Draw next card from deck
  const draw = useCallback(() => {
    return deckRef.current.pop();
  }, []);

  // ── Deal ────────────────────────────────────────────
  const handleDeal = useCallback(async () => {
    if (busy) return;
    if (bet < MIN_BET) { showToast('Minimum bet is ' + MIN_BET, 'error'); return; }
    if (balance < bet) { showToast('Not enough points!', 'error'); return; }

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

    // Fresh deck
    deckRef.current = createDeck();

    const p1 = draw(); audio.cardDeal();
    const d1 = draw();
    const p2 = draw(); audio.cardDeal();
    const d2 = draw();

    const pCards = [p1, p2];
    const dCards = [d1, d2];

    setPlayerCards(pCards);
    setDealerCards(dCards);
    setDealerHidden(true);
    setResultText('');
    setResultNet(0);

    // Check for natural blackjacks
    if (isBlackjack(pCards) && isBlackjack(dCards)) {
      setDealerHidden(false);
      await finishRound(pCards, dCards, bet, 'push');
    } else if (isBlackjack(pCards)) {
      setDealerHidden(false);
      await finishRound(pCards, dCards, bet, 'blackjack');
    } else if (isBlackjack(dCards)) {
      setDealerHidden(false);
      await finishRound(pCards, dCards, bet, 'dealer_blackjack');
    } else {
      setPhase(PHASE.PLAYING);
      setBusy(false);
    }
  }, [bet, balance, busy, username]);

  // ── Hit ─────────────────────────────────────────────
  const handleHit = useCallback(() => {
    if (busy || phase !== PHASE.PLAYING) return;
    const card = draw();
    audio.cardDeal();
    const next = [...playerCards, card];
    setPlayerCards(next);

    if (handValue(next).total > 21) {
      setBusy(true);
      setDealerHidden(false);
      finishRound(next, dealerCards, bet, 'bust');
    }
  }, [busy, phase, playerCards, dealerCards, bet]);

  // ── Stand ───────────────────────────────────────────
  const handleStand = useCallback(async () => {
    if (busy || phase !== PHASE.PLAYING) return;
    setBusy(true);
    setDealerHidden(false);
    audio.cardFlip();
    setPhase(PHASE.DEALER);

    let dCards = [...dealerCards];
    // Dealer draws
    while (dealerShouldHit(dCards)) {
      await delay(500);
      dCards = [...dCards, draw()];
      setDealerCards([...dCards]);
    }

    // Evaluate
    const pTotal = handValue(playerCards).total;
    const dTotal = handValue(dCards).total;

    let outcome;
    if (dTotal > 21) outcome = 'win';
    else if (pTotal > dTotal) outcome = 'win';
    else if (pTotal === dTotal) outcome = 'push';
    else outcome = 'lose';

    await finishRound(playerCards, dCards, bet, outcome);
  }, [busy, phase, playerCards, dealerCards, bet]);

  // ── Double ──────────────────────────────────────────
  const handleDouble = useCallback(async () => {
    if (busy || phase !== PHASE.PLAYING) return;
    if (playerCards.length !== 2) return;
    if (balance < bet) { showToast('Not enough points to double!', 'error'); return; }

    setBusy(true);
    setBalance((prev) => prev - bet);

    try {
      await deductPoints(username, bet);
    } catch {
      setBalance((prev) => prev + bet);
      setBusy(false);
      showToast('API error — double refunded', 'error');
      return;
    }

    const doubleBet = bet * 2;
    const card = draw();
    const pCards = [...playerCards, card];
    setPlayerCards(pCards);

    if (handValue(pCards).total > 21) {
      setDealerHidden(false);
      await finishRound(pCards, dealerCards, doubleBet, 'bust');
      return;
    }

    // Stand after double
    setDealerHidden(false);
    setPhase(PHASE.DEALER);

    let dCards = [...dealerCards];
    while (dealerShouldHit(dCards)) {
      await delay(500);
      dCards = [...dCards, draw()];
      setDealerCards([...dCards]);
    }

    const pTotal = handValue(pCards).total;
    const dTotal = handValue(dCards).total;

    let outcome;
    if (dTotal > 21) outcome = 'win';
    else if (pTotal > dTotal) outcome = 'win';
    else if (pTotal === dTotal) outcome = 'push';
    else outcome = 'lose';

    await finishRound(pCards, dCards, doubleBet, outcome);
  }, [busy, phase, playerCards, dealerCards, bet, balance, username]);

  // ── Finish round ────────────────────────────────────
  const finishRound = async (pCards, dCards, totalBet, outcome) => {
    let payout = 0;
    let text = '';
    let net = 0;
    let historyType = 'loss';

    const pTotal = handValue(pCards).total;
    const dTotal = handValue(dCards).total;

    switch (outcome) {
      case 'blackjack':
        payout = Math.floor(totalBet * 2.5);
        text = `BLACKJACK! +${payout.toLocaleString()}`;
        net = payout - totalBet;
        historyType = 'win';
        break;
      case 'win':
        payout = totalBet * 2;
        text = `WIN! +${payout.toLocaleString()}`;
        net = payout - totalBet;
        historyType = 'win';
        break;
      case 'push':
        payout = totalBet;
        text = `PUSH — Bet returned`;
        net = 0;
        historyType = 'loss'; // neutral, but not a win
        break;
      case 'bust':
        payout = 0;
        text = `BUST! -${totalBet.toLocaleString()}`;
        net = -totalBet;
        break;
      case 'dealer_blackjack':
        payout = 0;
        text = `DEALER BLACKJACK! -${totalBet.toLocaleString()}`;
        net = -totalBet;
        break;
      case 'lose':
      default:
        payout = 0;
        text = `LOSE — -${totalBet.toLocaleString()}`;
        net = -totalBet;
        break;
    }

    // Add winnings
    if (payout > 0) {
      try {
        await addPoints(username, payout);
        setBalance((prev) => prev + payout);
      } catch {
        showToast('Failed to add winnings', 'error');
      }
    }

    // Report to leaderboard
    try {
      await reportSpin(username, totalBet, payout);
    } catch {}

    // Build history emoji summary
    const emoji = `🃏 ${pCards.map((c) => c.display).join(' ')} vs ${dCards.map((c) => c.display).join(' ')} (${pTotal} vs ${dTotal})`;
    addHistory([{ emoji }], net, net >= 0 ? 'win' : 'loss', 'blackjack');

    // Sound
    if (net > 0) audio.win(payout / totalBet);
    else if (net < 0) audio.loss();

    setResultText(text);
    setResultNet(net);
    setPhase(PHASE.RESULT);
    setBusy(false);
  };

  // ── New round ───────────────────────────────────────
  const handleNewRound = () => {
    setPhase(PHASE.BETTING);
    setPlayerCards([]);
    setDealerCards([]);
    setDealerHidden(true);
    setResultText('');
    setResultNet(0);
  };

  // ── Custom bet handler ──────────────────────────────
  const handleCustomBet = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomBet(val);
    const num = parseInt(val, 10);
    if (num >= MIN_BET) setBet(num);
  };

  const handlePreset = (amount) => {
    setBet(amount);
    setCustomBet('');
  };

  const pValue = handValue(playerCards);
  const dValue = handValue(dealerCards);
  const showingBet = phase === PHASE.BETTING;
  const canDouble = phase === PHASE.PLAYING && playerCards.length === 2 && balance >= bet && !busy;

  return (
    <div style={styles.wrapper}>
      {/* ── Dealer hand ───────────────────────────── */}
      <div style={styles.handSection}>
        <div style={styles.handLabel}>
          <span style={styles.labelText}>DEALER</span>
          {dealerCards.length > 0 && (
            <span style={styles.totalBadge}>
              {dealerHidden ? '?' : dValue.total}
            </span>
          )}
        </div>
        <div style={styles.cardsRow}>
          <AnimatePresence>
            {dealerCards.map((card, i) => (
              <Card key={`d-${i}`} card={card} hidden={dealerHidden && i === 1} index={i} />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Result overlay ────────────────────────── */}
      <AnimatePresence>
        {phase === PHASE.RESULT && resultText && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            style={{
              ...styles.resultOverlay,
              color: resultNet > 0 ? 'var(--signal-go)' : resultNet < 0 ? 'var(--signal-stop)' : 'var(--discharge)',
            }}
          >
            {resultText}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Player hand ───────────────────────────── */}
      <div style={styles.handSection}>
        <div style={styles.handLabel}>
          <span style={styles.labelText}>YOU</span>
          {playerCards.length > 0 && (
            <span style={styles.totalBadge}>
              {pValue.total}{pValue.soft ? ' (soft)' : ''}
            </span>
          )}
        </div>
        <div style={styles.cardsRow}>
          <AnimatePresence>
            {playerCards.map((card, i) => (
              <Card key={`p-${i}`} card={card} hidden={false} index={i} />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Action buttons ────────────────────────── */}
      {phase === PHASE.PLAYING && !busy && (
        <div style={styles.actionsRow}>
          <button style={{ ...styles.actionBtn, ...styles.hitBtn }} onClick={handleHit}>
            HIT
          </button>
          <button style={{ ...styles.actionBtn, ...styles.standBtn }} onClick={handleStand}>
            STAND
          </button>
          {canDouble && (
            <button style={{ ...styles.actionBtn, ...styles.doubleBtn }} onClick={handleDouble}>
              DOUBLE
            </button>
          )}
        </div>
      )}

      {/* ── Betting controls ──────────────────────── */}
      {showingBet && (
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
                  }}
                  onClick={() => handlePreset(amount)}
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
            />
            <div style={styles.balanceDisplay}>
              <span style={styles.balLabel}>Bal</span>
              <span style={styles.balAmount}>{balance.toLocaleString()}</span>
              <span style={styles.balPts}>pts</span>
            </div>
          </div>
          <button
            style={{
              ...styles.dealBtn,
              opacity: balance < bet || bet < MIN_BET ? 0.4 : 1,
            }}
            onClick={handleDeal}
            disabled={balance < bet || bet < MIN_BET || busy}
          >
            DEAL {bet.toLocaleString()}
          </button>
        </div>
      )}

      {/* ── Result: new round ─────────────────────── */}
      {phase === PHASE.RESULT && (
        <button style={styles.dealBtn} onClick={handleNewRound}>
          NEW HAND
        </button>
      )}

      {/* ── Dealer turn indicator ─────────────────── */}
      {phase === PHASE.DEALER && (
        <div style={styles.dealerThinking}>Dealer drawing...</div>
      )}
    </div>
  );
}

// ── Inline styles (uses CSS vars from design system) ────
const styles = {
  wrapper: {
    width: '100%',
    maxWidth: 440,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--sp-4)',
    padding: 'var(--sp-4)',
    fontFamily: "'Chakra Petch', sans-serif",
    color: 'var(--ink)',
  },
  handSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--sp-2)',
  },
  handLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-2)',
  },
  labelText: {
    fontFamily: "'Russo One', sans-serif",
    fontSize: 13,
    letterSpacing: 1,
    color: 'var(--ink-secondary)',
    textTransform: 'uppercase',
  },
  totalBadge: {
    background: 'var(--raised)',
    border: '1px solid var(--bezel)',
    borderRadius: 'var(--r-sm)',
    padding: '2px 8px',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--ink)',
  },
  cardsRow: {
    display: 'flex',
    gap: 'var(--sp-2)',
    flexWrap: 'wrap',
    minHeight: 68,
    alignItems: 'center',
  },
  resultOverlay: {
    textAlign: 'center',
    fontFamily: "'Russo One', sans-serif",
    fontSize: 20,
    padding: 'var(--sp-3) 0',
    letterSpacing: 1,
  },
  actionsRow: {
    display: 'flex',
    gap: 'var(--sp-2)',
    justifyContent: 'center',
  },
  actionBtn: {
    flex: 1,
    maxWidth: 120,
    padding: 'var(--sp-3) var(--sp-4)',
    borderRadius: 'var(--r-md)',
    border: 'none',
    fontFamily: "'Russo One', sans-serif",
    fontSize: 14,
    letterSpacing: 1,
    cursor: 'pointer',
    color: '#fff',
    transition: 'opacity var(--t-fast)',
  },
  hitBtn: {
    background: 'var(--phosphor)',
  },
  standBtn: {
    background: 'var(--signal-hot)',
  },
  doubleBtn: {
    background: 'var(--discharge)',
    color: '#1e1e2e',
  },
  betSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--sp-3)',
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
  balanceDisplay: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-1)',
    fontSize: 12,
  },
  balLabel: { color: 'var(--ink-tertiary)' },
  balAmount: { color: 'var(--discharge)', fontWeight: 700 },
  balPts: { color: 'var(--ink-tertiary)' },
  dealBtn: {
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
  dealerThinking: {
    textAlign: 'center',
    fontFamily: "'Chakra Petch', sans-serif",
    fontSize: 14,
    color: 'var(--ink-tertiary)',
    fontStyle: 'italic',
    padding: 'var(--sp-2) 0',
  },
};
