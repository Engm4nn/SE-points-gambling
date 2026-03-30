import { useState, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import Reel from './Reel';
import BetControls from './BetControls';
import WinDisplay from './WinDisplay';
import VaultHeist from './VaultHeist';
import { REEL_COUNT, SPIN_DURATION_BASE, SPIN_STAGGER, BONUS_BUY_MULTIPLIER, JACKPOT_CONTRIBUTION_RATE } from '../utils/constants';
import { spinReels, evaluateWin, isBonusTriggered, isNearMiss } from '../utils/slotLogic';
import { deductPoints, addPoints } from '../utils/api';
import { audio } from '../utils/audio';
import { sendChatMessage, formatWinMessage, shouldAnnounce } from '../utils/chatBot';
import { reportSpin } from '../utils/leaderboardApi';
import { contributeToJackpot, winJackpot } from '../utils/jackpotApi';
import { Trophy } from 'lucide-react';

export default function SlotMachine({ balance, setBalance, username, jackpot, setJackpot, addHistory, showToast }) {
  const [spinning, setSpinning] = useState(false);
  const [results, setResults] = useState([null, null, null]);
  const [bet, setBet] = useState(10);
  const [lastWin, setLastWin] = useState(null);
  const [showVault, setShowVault] = useState(false);
  const [vaultBet, setVaultBet] = useState(0);
  const [nearMiss, setNearMiss] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const stoppedReels = useRef(0);
  const currentResults = useRef([]);
  const autoSpinRef = useRef(false);
  const broadcastChannel = useRef(
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('streamslots_wins') : null
  );

  autoSpinRef.current = autoSpin;

  const canSpin = !spinning && !showVault && balance >= bet;
  const spinBase = turbo ? 200 : SPIN_DURATION_BASE;
  const spinStagger = turbo ? 50 : SPIN_STAGGER;

  const handleSpin = useCallback(async (isBonusBuy = false) => {
    if (spinning || showVault) return;
    await audio.ensure();

    const actualBet = isBonusBuy ? bet * BONUS_BUY_MULTIPLIER : bet;

    if (balance < actualBet) {
      showToast('Not enough points!', 'error');
      setAutoSpin(false);
      return;
    }

    setBalance(prev => prev - actualBet);
    setSpinning(true);
    setLastWin(null);
    setNearMiss(false);
    stoppedReels.current = 0;

    const spinResults = spinReels();
    currentResults.current = spinResults;
    setResults(spinResults);

    try {
      await deductPoints(username, actualBet);
    } catch {
      setBalance(prev => prev + actualBet);
      setSpinning(false);
      setAutoSpin(false);
      showToast('API error — bet refunded', 'error');
      return;
    }

    if (isBonusBuy) {
      currentResults.current = [
        { id: 'bonus', emoji: '🃏', label: 'Bonus' },
        { id: 'bonus', emoji: '🃏', label: 'Bonus' },
        { id: 'bonus', emoji: '🃏', label: 'Bonus' },
      ];
      setResults(currentResults.current);
    }
  }, [spinning, showVault, bet, balance, username, showToast, setBalance]);

  // Vault Heist complete callback
  const handleVaultComplete = useCallback((totalMultiplier) => {
    const payout = Math.floor(vaultBet * totalMultiplier);
    if (payout > 0) {
      setBalance(prev => prev + payout);
      addPoints(username, payout).catch(() => {});
      showToast(`Vault Heist: ${totalMultiplier}x — +${(payout - vaultBet).toLocaleString()} pts!`, payout > vaultBet * 5 ? 'mega' : 'win');
      if (shouldAnnounce(payout, vaultBet, 'win')) {
        const siteUrl = window.location.origin;
        sendChatMessage(formatWinMessage(username, payout, totalMultiplier, 'mega', siteUrl));
      }
    }
    addHistory([{ emoji: `🔓 Vault ${totalMultiplier}x` }], payout - vaultBet, payout > 0 ? 'win' : 'loss');
    reportSpin(username, vaultBet, payout);
    setShowVault(false);
    setVaultBet(0);
  }, [vaultBet, username, setBalance, showToast, addHistory]);

  const handleReelStop = useCallback((reelIndex) => {
    stoppedReels.current += 1;
    audio.reelStop();

    if (stoppedReels.current >= REEL_COUNT) {
      setSpinning(false);

      const res = currentResults.current;

      // Bonus trigger → Vault Heist
      if (isBonusTriggered(res)) {
        audio.bonus();
        setAutoSpin(false);
        setVaultBet(bet);
        setShowVault(true);
        return;
      }

      const winResult = evaluateWin(res, bet, jackpot);

      if (winResult.type === 'jackpot') {
        audio.jackpot();
        winJackpot().then(data => {
          if (data) {
            setBalance(prev => prev + data.won);
            addPoints(username, data.won).catch(() => {});
            setJackpot(data.jackpot);
            setLastWin({ ...winResult, amount: data.won });
            addHistory(res, data.won, 'jackpot');
            showToast(`JACKPOT! +${data.won.toLocaleString()} pts!`, 'jackpot');
            const siteUrl = window.location.origin;
            sendChatMessage(formatWinMessage(username, data.won, null, 'jackpot', siteUrl));
            broadcastChannel.current?.postMessage({ type: 'jackpot', username, amount: data.won });
          }
        });
      } else if (winResult.winAmount > 0) {
        audio.win(winResult.multiplier);
        setBalance(prev => prev + winResult.winAmount);
        addPoints(username, winResult.winAmount).catch(() => {});
        setLastWin({ ...winResult, amount: winResult.winAmount });
        const winType = winResult.multiplier >= 25 ? 'mega' : winResult.multiplier >= 10 ? 'big' : 'win';
        addHistory(res, winResult.winAmount - bet, winType === 'mega' ? 'mega' : 'win');
        showToast(`+${winResult.winAmount.toLocaleString()} pts!`, winType === 'mega' ? 'mega' : 'win');
        if (shouldAnnounce(winResult.winAmount, bet, winType)) {
          const siteUrl = window.location.origin;
          sendChatMessage(formatWinMessage(username, winResult.winAmount, winResult.multiplier, winType, siteUrl));
          broadcastChannel.current?.postMessage({ type: winType, username, amount: winResult.winAmount, multiplier: winResult.multiplier });
        }
      } else {
        audio.loss();
        // Always contribute at least 1 point on a loss
        const contribution = Math.max(1, Math.floor(bet * JACKPOT_CONTRIBUTION_RATE));
        contributeToJackpot(contribution).then(newJp => {
          if (newJp) setJackpot(newJp);
        });
        setLastWin(null);
        addHistory(res, -bet, 'loss');
      }

      reportSpin(username, bet, winResult.winAmount || 0);

      if (isNearMiss(res)) {
        setNearMiss(true);
      }
    }
  }, [bet, jackpot, username, setBalance, setJackpot, addHistory, showToast]);

  const handleBonusBuy = useCallback(() => {
    handleSpin(true);
  }, [handleSpin]);

  // Autospin
  useEffect(() => {
    if (!autoSpinRef.current || spinning || showVault) return;
    if (balance < bet) {
      setAutoSpin(false);
      return;
    }
    const delay = turbo ? 50 : 600;
    const timer = setTimeout(() => {
      if (autoSpinRef.current) handleSpin();
    }, delay);
    return () => clearTimeout(timer);
  }, [spinning, autoSpin, showVault, balance, bet, turbo, handleSpin]);

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
            bonusMode={false}
          />
        ))}
      </div>

      <AnimatePresence>
        {lastWin && <WinDisplay win={lastWin} nearMiss={nearMiss} />}
      </AnimatePresence>

      <BetControls
        bet={bet}
        setBet={setBet}
        balance={balance}
        spinning={spinning || showVault}
        onSpin={() => handleSpin(false)}
        onBonusBuy={handleBonusBuy}
        bonusMode={false}
        autoSpin={autoSpin}
        onAutoSpinToggle={() => setAutoSpin(prev => !prev)}
        turbo={turbo}
        onTurboToggle={() => setTurbo(prev => !prev)}
      />

      {/* Vault Heist bonus overlay */}
      <AnimatePresence>
        {showVault && (
          <VaultHeist bet={vaultBet} onComplete={handleVaultComplete} />
        )}
      </AnimatePresence>
    </div>
  );
}
