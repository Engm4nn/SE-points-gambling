import { useState, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import Reel from './Reel';
import BetControls from './BetControls';
import WinDisplay from './WinDisplay';
import BonusOverlay from './BonusOverlay';
import { REEL_COUNT, SPIN_DURATION_BASE, SPIN_STAGGER, BONUS_BUY_MULTIPLIER, BONUS_FREE_SPINS, BONUS_WIN_MULTIPLIER, JACKPOT_CONTRIBUTION_RATE, JACKPOT_SEED } from '../utils/constants';
import { spinReels, evaluateWin, isBonusTriggered, isNearMiss } from '../utils/slotLogic';
import { deductPoints, addPoints } from '../utils/api';
import { audio } from '../utils/audio';
import { sendChatMessage, formatWinMessage, shouldAnnounce } from '../utils/chatBot';
import { Trophy, Sparkles } from 'lucide-react';

export default function SlotMachine({ balance, setBalance, channel, username, jwt, jackpot, setJackpot, addHistory, addLeaderboardEntry, showToast }) {
  const [spinning, setSpinning] = useState(false);
  const [results, setResults] = useState([null, null, null]);
  const [bet, setBet] = useState(100);
  const [lastWin, setLastWin] = useState(null);
  const [bonusMode, setBonusMode] = useState(false);
  const [bonusSpinsLeft, setBonusSpinsLeft] = useState(0);
  const [nearMiss, setNearMiss] = useState(false);
  const stoppedReels = useRef(0);
  const currentResults = useRef([]);
  const broadcastChannel = useRef(
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('streamslots_wins') : null
  );

  const handleSpin = useCallback(async (isBonusBuy = false) => {
    if (spinning) return;
    await audio.ensure();

    const actualBet = isBonusBuy ? bet * BONUS_BUY_MULTIPLIER : bet;
    if (balance < actualBet) {
      showToast('Not enough points!', 'error');
      return;
    }

    // Optimistic deduct
    setBalance(prev => prev - actualBet);
    setSpinning(true);
    setLastWin(null);
    setNearMiss(false);
    stoppedReels.current = 0;
    audio.startSpin();

    // Generate results
    const spinResults = spinReels();
    currentResults.current = spinResults;
    setResults(spinResults);

    // API deduct
    try {
      await deductPoints(channel, username, actualBet, jwt);
    } catch (err) {
      // Refund on API error
      setBalance(prev => prev + actualBet);
      setSpinning(false);
      audio.stopSpin();
      showToast('API error — bet refunded', 'error');
      return;
    }

    // If bonus buy, force bonus trigger
    if (isBonusBuy) {
      currentResults.current = [
        { id: 'bonus', emoji: '🃏', label: 'Bonus' },
        { id: 'bonus', emoji: '🃏', label: 'Bonus' },
        { id: 'bonus', emoji: '🃏', label: 'Bonus' },
      ];
      setResults(currentResults.current);
    }
  }, [spinning, bet, balance, channel, username, jwt, showToast, setBalance]);

  const handleReelStop = useCallback((reelIndex) => {
    stoppedReels.current += 1;
    audio.reelStop();

    if (stoppedReels.current >= REEL_COUNT) {
      audio.stopSpin();
      setSpinning(false);

      const res = currentResults.current;

      // Check bonus trigger
      if (isBonusTriggered(res)) {
        audio.bonus();
        setBonusMode(true);
        setBonusSpinsLeft(BONUS_FREE_SPINS);
        showToast('BONUS MODE ACTIVATED!', 'bonus');
        return;
      }

      // Evaluate win
      const currentBet = bonusMode ? bet : bet;
      const winResult = evaluateWin(res, currentBet, jackpot);

      // Apply bonus multiplier
      if (bonusMode && winResult.winAmount > 0) {
        winResult.winAmount = Math.floor(winResult.winAmount * BONUS_WIN_MULTIPLIER);
        winResult.label += ` (×${BONUS_WIN_MULTIPLIER} Bonus)`;
      }

      if (winResult.type === 'jackpot') {
        audio.jackpot();
        setBalance(prev => prev + jackpot);
        addPoints(channel, username, jackpot, jwt).catch(() => {});
        setJackpot(JACKPOT_SEED);
        setLastWin({ ...winResult, amount: jackpot });
        addHistory(res, jackpot, 'jackpot');
        addLeaderboardEntry(username, jackpot, 'JACKPOT');
        showToast(`JACKPOT! +${jackpot.toLocaleString()} pts!`, 'jackpot');
        // Chat + overlay announce
        const siteUrl = window.location.origin;
        sendChatMessage(channel, jwt, formatWinMessage(username, jackpot, null, 'jackpot', siteUrl));
        broadcastChannel.current?.postMessage({ type: 'jackpot', username, amount: jackpot });
      } else if (winResult.winAmount > 0) {
        audio.win(winResult.multiplier);
        setBalance(prev => prev + winResult.winAmount);
        addPoints(channel, username, winResult.winAmount, jwt).catch(() => {});
        setLastWin({ ...winResult, amount: winResult.winAmount });
        const winType = winResult.multiplier >= 25 ? 'mega' : winResult.multiplier >= 10 ? 'big' : 'win';
        addHistory(res, winResult.winAmount - bet, winType === 'mega' ? 'mega' : 'win');
        if (winResult.winAmount >= bet * 5) {
          addLeaderboardEntry(username, winResult.winAmount, winResult.label);
        }
        showToast(`+${winResult.winAmount.toLocaleString()} pts!`, winType === 'mega' ? 'mega' : 'win');
        // Announce big wins in chat + overlay
        if (shouldAnnounce(winResult.winAmount, bet, winType)) {
          const siteUrl = window.location.origin;
          sendChatMessage(channel, jwt, formatWinMessage(username, winResult.winAmount, winResult.multiplier, winType, siteUrl));
          broadcastChannel.current?.postMessage({ type: winType, username, amount: winResult.winAmount, multiplier: winResult.multiplier });
        }
      } else {
        audio.loss();
        // Contribute to jackpot
        setJackpot(prev => prev + Math.floor(bet * JACKPOT_CONTRIBUTION_RATE));
        setLastWin(null);
        addHistory(res, -bet, 'loss');
      }

      // Near miss check
      if (isNearMiss(res)) {
        setNearMiss(true);
      }

      // Bonus mode countdown
      if (bonusMode) {
        setBonusSpinsLeft(prev => {
          const next = prev - 1;
          if (next <= 0) {
            setBonusMode(false);
            showToast('Bonus mode ended!', 'info');
          }
          return next;
        });
        // Auto-spin in bonus mode
        if (bonusSpinsLeft > 1) {
          setTimeout(() => handleSpin(), 1500);
        }
      }
    }
  }, [bonusMode, bonusSpinsLeft, bet, jackpot, channel, username, jwt, setBalance, setJackpot, addHistory, addLeaderboardEntry, showToast, handleSpin]);

  const handleBonusBuy = useCallback(() => {
    handleSpin(true);
  }, [handleSpin]);

  const handleKeyDown = useCallback((e) => {
    if (e.code === 'Space' && !spinning && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      if (bonusMode && bonusSpinsLeft > 0) {
        handleSpin();
      } else {
        handleSpin();
      }
    }
  }, [spinning, bonusMode, bonusSpinsLeft, handleSpin]);

  // Attach keyboard listener
  if (typeof window !== 'undefined') {
    window.onkeydown = handleKeyDown;
  }

  return (
    <div className="slot-machine">
      {/* Jackpot display */}
      <div className="jackpot-display">
        <span className="jackpot-icon"><Trophy size={20} /></span>
        <span className="jackpot-label">JACKPOT</span>
        <span className="jackpot-amount">{jackpot.toLocaleString()} pts</span>
      </div>

      {/* Reels */}
      <div className="reels-container">
        {[0, 1, 2].map(i => (
          <Reel
            key={i}
            reelIndex={i}
            spinning={spinning}
            targetSymbol={results[i]}
            delay={SPIN_DURATION_BASE + i * SPIN_STAGGER}
            onStop={handleReelStop}
            bonusMode={bonusMode}
          />
        ))}
      </div>

      {/* Win display */}
      <AnimatePresence>
        {lastWin && <WinDisplay win={lastWin} nearMiss={nearMiss} />}
      </AnimatePresence>

      {/* Bonus mode indicator */}
      {bonusMode && (
        <div className="bonus-indicator">
          <Sparkles size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
          FREE SPINS: {bonusSpinsLeft} remaining
        </div>
      )}

      {/* Bet controls */}
      <BetControls
        bet={bet}
        setBet={setBet}
        balance={balance}
        spinning={spinning}
        onSpin={() => handleSpin(false)}
        onBonusBuy={handleBonusBuy}
        bonusMode={bonusMode}
      />

      {/* Bonus overlay */}
      <AnimatePresence>
        {bonusMode && bonusSpinsLeft === BONUS_FREE_SPINS && (
          <BonusOverlay onComplete={() => {}} />
        )}
      </AnimatePresence>
    </div>
  );
}
