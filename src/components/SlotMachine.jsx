import { useState, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import Reel from './Reel';
import BetControls from './BetControls';
import WinDisplay from './WinDisplay';
import BonusWheel from './BonusWheel';
import { REEL_COUNT, SPIN_DURATION_BASE, SPIN_STAGGER, BONUS_BUY_MULTIPLIER, JACKPOT_CONTRIBUTION_RATE, JACKPOT_SEED } from '../utils/constants';
import { spinReels, evaluateWin, isBonusTriggered, isNearMiss } from '../utils/slotLogic';
import { deductPoints, addPoints } from '../utils/api';
import { audio } from '../utils/audio';
import { sendChatMessage, formatWinMessage, shouldAnnounce } from '../utils/chatBot';
import { Trophy, Sparkles } from 'lucide-react';

const BONUS_SPINS = 3;

export default function SlotMachine({ balance, setBalance, username, jackpot, setJackpot, addHistory, addLeaderboardEntry, showToast }) {
  const [spinning, setSpinning] = useState(false);
  const [results, setResults] = useState([null, null, null]);
  const [bet, setBet] = useState(10);
  const [lastWin, setLastWin] = useState(null);
  const [bonusMode, setBonusMode] = useState(false);
  const [bonusSpinsLeft, setBonusSpinsLeft] = useState(0);
  const [bonusMultiplier, setBonusMultiplier] = useState(1);
  const [showWheel, setShowWheel] = useState(false);
  const [nearMiss, setNearMiss] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const stoppedReels = useRef(0);
  const currentResults = useRef([]);
  const autoSpinRef = useRef(false);
  const broadcastChannel = useRef(
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('streamslots_wins') : null
  );

  // Keep ref in sync so callbacks see latest value
  autoSpinRef.current = autoSpin;

  const canSpin = !spinning && !showWheel && (bonusMode ? bonusSpinsLeft > 0 : balance >= bet);

  // Turbo timing
  const spinBase = turbo ? 500 : SPIN_DURATION_BASE;
  const spinStagger = turbo ? 100 : SPIN_STAGGER;

  const handleSpin = useCallback(async (isBonusBuy = false) => {
    if (spinning) return;
    await audio.ensure();

    const actualBet = bonusMode ? 0 : (isBonusBuy ? bet * BONUS_BUY_MULTIPLIER : bet);

    if (!bonusMode && balance < actualBet) {
      showToast('Not enough points!', 'error');
      setAutoSpin(false);
      return;
    }

    if (actualBet > 0) {
      setBalance(prev => prev - actualBet);
    }

    setSpinning(true);
    setLastWin(null);
    setNearMiss(false);
    stoppedReels.current = 0;

    const spinResults = spinReels();
    currentResults.current = spinResults;
    setResults(spinResults);

    if (actualBet > 0) {
      try {
        await deductPoints(username, actualBet);
      } catch {
        setBalance(prev => prev + actualBet);
        setSpinning(false);
        setAutoSpin(false);
        showToast('API error — bet refunded', 'error');
        return;
      }
    }

    if (isBonusBuy) {
      currentResults.current = [
        { id: 'bonus', emoji: '🃏', label: 'Bonus' },
        { id: 'bonus', emoji: '🃏', label: 'Bonus' },
        { id: 'bonus', emoji: '🃏', label: 'Bonus' },
      ];
      setResults(currentResults.current);
    }
  }, [spinning, bet, balance, username, showToast, setBalance, bonusMode]);

  const handleWheelResult = useCallback((multiplier) => {
    setBonusMultiplier(multiplier);
    setShowWheel(false);
    setBonusMode(true);
    setBonusSpinsLeft(BONUS_SPINS);
    showToast(`${multiplier}x multiplier! ${BONUS_SPINS} free spins!`, 'bonus');
  }, [showToast]);

  const handleReelStop = useCallback((reelIndex) => {
    stoppedReels.current += 1;
    audio.reelStop();

    if (stoppedReels.current >= REEL_COUNT) {
      setSpinning(false);

      const res = currentResults.current;

      // Bonus trigger → wheel
      if (isBonusTriggered(res)) {
        audio.bonus();
        setAutoSpin(false); // pause autospin for wheel
        setShowWheel(true);
        return;
      }

      const winResult = evaluateWin(res, bet, jackpot);

      if (bonusMode && winResult.winAmount > 0) {
        winResult.winAmount = Math.floor(winResult.winAmount * bonusMultiplier);
        winResult.label += ` (${bonusMultiplier}x Bonus)`;
      }

      if (winResult.type === 'jackpot') {
        audio.jackpot();
        const jackpotWin = bonusMode ? Math.floor(jackpot * bonusMultiplier) : jackpot;
        setBalance(prev => prev + jackpotWin);
        addPoints(username, jackpotWin).catch(() => {});
        setJackpot(JACKPOT_SEED);
        setLastWin({ ...winResult, amount: jackpotWin });
        addHistory(res, jackpotWin, 'jackpot');
        addLeaderboardEntry(username, jackpotWin, 'JACKPOT');
        showToast(`JACKPOT! +${jackpotWin.toLocaleString()} pts!`, 'jackpot');
        const siteUrl = window.location.origin;
        sendChatMessage(formatWinMessage(username, jackpotWin, null, 'jackpot', siteUrl));
        broadcastChannel.current?.postMessage({ type: 'jackpot', username, amount: jackpotWin });
      } else if (winResult.winAmount > 0) {
        audio.win(winResult.multiplier);
        setBalance(prev => prev + winResult.winAmount);
        addPoints(username, winResult.winAmount).catch(() => {});
        setLastWin({ ...winResult, amount: winResult.winAmount });
        const effectiveMult = bonusMode ? winResult.multiplier * bonusMultiplier : winResult.multiplier;
        const winType = effectiveMult >= 25 ? 'mega' : effectiveMult >= 10 ? 'big' : 'win';
        addHistory(res, winResult.winAmount - (bonusMode ? 0 : bet), winType === 'mega' ? 'mega' : 'win');
        if (winResult.winAmount >= bet * 5) {
          addLeaderboardEntry(username, winResult.winAmount, winResult.label);
        }
        showToast(`+${winResult.winAmount.toLocaleString()} pts!`, winType === 'mega' ? 'mega' : 'win');
        if (shouldAnnounce(winResult.winAmount, bet, winType)) {
          const siteUrl = window.location.origin;
          sendChatMessage(formatWinMessage(username, winResult.winAmount, effectiveMult, winType, siteUrl));
          broadcastChannel.current?.postMessage({ type: winType, username, amount: winResult.winAmount, multiplier: effectiveMult });
        }
      } else {
        audio.loss();
        if (!bonusMode) {
          setJackpot(prev => prev + Math.floor(bet * JACKPOT_CONTRIBUTION_RATE));
        }
        setLastWin(null);
        addHistory(res, bonusMode ? 0 : -bet, 'loss');
      }

      if (isNearMiss(res)) {
        setNearMiss(true);
      }

      // Bonus countdown
      if (bonusMode) {
        setBonusSpinsLeft(prev => {
          const next = prev - 1;
          if (next <= 0) {
            setBonusMode(false);
            setBonusMultiplier(1);
            showToast('Bonus mode ended!', 'info');
          }
          return next;
        });
      }
    }
  }, [bonusMode, bonusMultiplier, bet, jackpot, username, setBalance, setJackpot, addHistory, addLeaderboardEntry, showToast]);

  const handleBonusBuy = useCallback(() => {
    handleSpin(true);
  }, [handleSpin]);

  // Autospin: trigger next spin after current one finishes
  useEffect(() => {
    if (!autoSpinRef.current || spinning || showWheel) return;

    // Check if we can still spin
    const canAutoSpin = bonusMode ? bonusSpinsLeft > 0 : balance >= bet;
    if (!canAutoSpin) {
      setAutoSpin(false);
      return;
    }

    const delay = turbo ? 200 : 600;
    const timer = setTimeout(() => {
      if (autoSpinRef.current) {
        handleSpin();
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [spinning, autoSpin, showWheel, bonusMode, bonusSpinsLeft, balance, bet, turbo, handleSpin]);

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
    <div className="slot-machine">
      <div className="jackpot-display">
        <span className="jackpot-icon"><Trophy size={18} /></span>
        <span className="jackpot-label">JACKPOT</span>
        <span className="jackpot-amount">{jackpot.toLocaleString()} pts</span>
      </div>

      <div className="reels-container">
        {[0, 1, 2].map(i => (
          <Reel
            key={i}
            reelIndex={i}
            spinning={spinning}
            targetSymbol={results[i]}
            delay={spinBase + i * spinStagger}
            onStop={handleReelStop}
            bonusMode={bonusMode}
          />
        ))}
      </div>

      <AnimatePresence>
        {lastWin && <WinDisplay win={lastWin} nearMiss={nearMiss} />}
      </AnimatePresence>

      {bonusMode && (
        <div className="bonus-indicator">
          <Sparkles size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
          FREE SPINS: {bonusSpinsLeft}/{BONUS_SPINS} — {bonusMultiplier}x multiplier
        </div>
      )}

      <BetControls
        bet={bet}
        setBet={setBet}
        balance={balance}
        spinning={spinning}
        onSpin={() => handleSpin(false)}
        onBonusBuy={handleBonusBuy}
        bonusMode={bonusMode}
        autoSpin={autoSpin}
        onAutoSpinToggle={() => setAutoSpin(prev => !prev)}
        turbo={turbo}
        onTurboToggle={() => setTurbo(prev => !prev)}
      />

      <AnimatePresence>
        {showWheel && (
          <BonusWheel onResult={handleWheelResult} />
        )}
      </AnimatePresence>
    </div>
  );
}
