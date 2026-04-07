import { useState, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import Reel from './Reel';
import BetControls from './BetControls';
import WinDisplay from './WinDisplay';
import BonusPicker from './BonusPicker';
import BonusWheel from './BonusWheel';
import VaultHeist from './VaultHeist';
import GoldenRain from './GoldenRain';
import ScratchCard from './ScratchCard';
import { REEL_COUNT, SPIN_DURATION_BASE, SPIN_STAGGER, BONUS_BUY_MULTIPLIER, JACKPOT_CONTRIBUTION_RATE } from '../utils/constants';
import { spinReels, evaluateWin, isBonusTriggered, isNearMiss } from '../utils/slotLogic';
import { deductPoints, addPoints, fetchPoints } from '../utils/api';
import { audio } from '../utils/audio';
import { sendChatMessage, formatWinMessage, shouldAnnounce } from '../utils/chatBot';
import { reportSpin } from '../utils/leaderboardApi';
import { contributeToJackpot, winJackpot } from '../utils/jackpotApi';
import WinShareOverlay from './WinShareOverlay';
import { Trophy, Sparkles } from 'lucide-react';

const BONUS_SPINS = 3;

export default function SlotMachine({ balance, setBalance, username, jackpot, setJackpot, addHistory, showToast }) {
  const [spinning, setSpinning] = useState(false);
  const [results, setResults] = useState([null, null, null]);
  const [bet, setBet] = useState(10);
  const [lastWin, setLastWin] = useState(null);
  const [nearMiss, setNearMiss] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const [turbo, setTurbo] = useState(false);

  // Bonus stages: none → picker → (wheel → freespins) | vault
  const [bonusStage, setBonusStage] = useState('none'); // none|picker|wheel|freespins|vault
  const [bonusMultiplier, setBonusMultiplier] = useState(1);
  const [bonusSpinsLeft, setBonusSpinsLeft] = useState(0);
  const [bonusBet, setBonusBet] = useState(0);
  const [shareWin, setShareWin] = useState(null); // { amount, multiplier, game }

  const stoppedReels = useRef(0);
  const currentResults = useRef([]);
  const autoSpinRef = useRef(false);
  const broadcastChannel = useRef(
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('streamslots_wins') : null
  );

  autoSpinRef.current = autoSpin;

  const inBonus = bonusStage !== 'none';
  const inFreeSpins = bonusStage === 'freespins';
  const inOverlay = bonusStage !== 'none' && bonusStage !== 'freespins';
  const canSpin = !spinning && !inOverlay && (inFreeSpins ? bonusSpinsLeft > 0 : balance >= bet);
  const spinBase = turbo ? 200 : SPIN_DURATION_BASE;
  const spinStagger = turbo ? 50 : SPIN_STAGGER;

  const handleSpin = useCallback(async (isBonusBuy = false) => {
    if (spinning || inOverlay) return;
    await audio.ensure();

    const actualBet = inFreeSpins ? 0 : (isBonusBuy ? bet * BONUS_BUY_MULTIPLIER : bet);

    if (!inFreeSpins) {
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
  }, [spinning, inOverlay, inFreeSpins, bet, balance, username, showToast, setBalance]);

  // Stage 1: Bonus picker result → route to game
  const handlePickerResult = useCallback((game) => {
    setBonusStage(game === 'freespins' ? 'wheel' : game);
  }, []);

  // Stage 2a: Wheel result → free spins
  const handleWheelResult = useCallback((multiplier) => {
    setBonusMultiplier(multiplier);
    setBonusStage('freespins');
    setBonusSpinsLeft(BONUS_SPINS);
    showToast(`${multiplier}x multiplier! ${BONUS_SPINS} free spins!`, 'bonus');
  }, [showToast]);

  // Generic bonus game complete — all instant-payout bonus games use this
  const handleBonusGameComplete = useCallback((totalMultiplier, gameName, emoji) => {
    const payout = Math.floor(bonusBet * totalMultiplier);
    if (payout > 0) {
      setBalance(prev => prev + payout);
      addPoints(username, payout).catch(() => {});
      showToast(`${gameName}: ${totalMultiplier}x — +${(payout - bonusBet).toLocaleString()} pts!`, payout > bonusBet * 5 ? 'mega' : 'win');
      // Show share overlay for bonus wins
      setShareWin({ amount: payout, multiplier: totalMultiplier, game: `Slots — ${gameName}` });
    } else {
      showToast(`${gameName}: ${totalMultiplier}x — no win`, 'error');
    }
    addHistory([{ emoji: `${emoji} ${gameName} ${totalMultiplier}x` }], payout - bonusBet, payout > 0 ? 'win' : 'loss');
    reportSpin(username, bonusBet, payout);
    setBonusStage('none');
    setBonusBet(0);
  }, [bonusBet, username, setBalance, showToast, addHistory]);

  const handleReelStop = useCallback((reelIndex) => {
    stoppedReels.current += 1;
    audio.reelStop();

    if (stoppedReels.current >= REEL_COUNT) {
      setSpinning(false);

      const res = currentResults.current;

      // Bonus trigger → picker wheel
      if (isBonusTriggered(res)) {
        audio.bonus();
        setAutoSpin(false);
        setBonusBet(bet);
        setBonusStage('picker');
        return;
      }

      const winResult = evaluateWin(res, bet, jackpot);

      // Apply free spins multiplier
      if (inFreeSpins && winResult.winAmount > 0) {
        winResult.winAmount = Math.floor(winResult.winAmount * bonusMultiplier);
        winResult.label += ` (${bonusMultiplier}x Bonus)`;
      }

      if (winResult.type === 'jackpot') {
        audio.jackpot();
        winJackpot().then(data => {
          if (data) {
            const jackpotWin = inFreeSpins ? Math.floor(data.won * bonusMultiplier) : data.won;
            setBalance(prev => prev + jackpotWin);
            addPoints(username, jackpotWin).catch(() => {});
            setJackpot(data.jackpot);
            setLastWin({ ...winResult, amount: jackpotWin });
            addHistory(res, jackpotWin, 'jackpot');
            showToast(`JACKPOT! +${jackpotWin.toLocaleString()} pts!`, 'jackpot');
            // Jackpot always auto-announces
            const siteUrl = window.location.origin;
            sendChatMessage(formatWinMessage(username, jackpotWin, null, 'jackpot', siteUrl));
            setShareWin({ amount: jackpotWin, multiplier: jackpotWin / bet, game: 'Slots — JACKPOT' });
            broadcastChannel.current?.postMessage({ type: 'jackpot', username, amount: jackpotWin });
          }
        });
      } else if (winResult.winAmount > 0) {
        audio.win(winResult.multiplier);
        setBalance(prev => prev + winResult.winAmount);
        addPoints(username, winResult.winAmount).catch(() => {});
        setLastWin({ ...winResult, amount: winResult.winAmount });
        const effectiveMult = inFreeSpins ? winResult.multiplier * bonusMultiplier : winResult.multiplier;
        const winType = effectiveMult >= 25 ? 'mega' : effectiveMult >= 10 ? 'big' : 'win';
        addHistory(res, winResult.winAmount - (inFreeSpins ? 0 : bet), winType === 'mega' ? 'mega' : 'win');
        showToast(`+${winResult.winAmount.toLocaleString()} pts!`, winType === 'mega' ? 'mega' : 'win');
        // Show share overlay for big wins (5x+), not during free spins (wait for bonus end)
        if (!inFreeSpins && effectiveMult >= 5) {
          setShareWin({ amount: winResult.winAmount, multiplier: effectiveMult, game: 'Slots' });
        }
        broadcastChannel.current?.postMessage({ type: winType, username, amount: winResult.winAmount, multiplier: effectiveMult });
      } else {
        audio.loss();
        if (!inFreeSpins) {
          const contribution = Math.max(1, Math.floor(bet * JACKPOT_CONTRIBUTION_RATE));
          contributeToJackpot(contribution).then(newJp => {
            if (newJp) setJackpot(newJp);
          });
        }
        setLastWin(null);
        addHistory(res, inFreeSpins ? 0 : -bet, 'loss');
      }

      if (!inFreeSpins) {
        reportSpin(username, bet, winResult.winAmount || 0);
      }

      if (isNearMiss(res)) {
        setNearMiss(true);
      }

      // Free spins countdown
      if (inFreeSpins) {
        setBonusSpinsLeft(prev => {
          const next = prev - 1;
          if (next <= 0) {
            setBonusStage('none');
            setBonusMultiplier(1);
            showToast('Free spins ended!', 'info');
          }
          return next;
        });
      }
    }
  }, [inFreeSpins, bonusMultiplier, bet, jackpot, username, setBalance, setJackpot, addHistory, showToast]);

  const handleBonusBuy = useCallback(() => {
    handleSpin(true);
  }, [handleSpin]);

  // Autospin
  useEffect(() => {
    if (!autoSpinRef.current || spinning || inOverlay) return;
    const canAutoSpin = inFreeSpins ? bonusSpinsLeft > 0 : balance >= bet;
    if (!canAutoSpin) {
      setAutoSpin(false);
      return;
    }
    const delay = turbo ? 50 : 600;
    const timer = setTimeout(() => {
      if (autoSpinRef.current) handleSpin();
    }, delay);
    return () => clearTimeout(timer);
  }, [spinning, autoSpin, inOverlay, inFreeSpins, bonusSpinsLeft, balance, bet, turbo, handleSpin]);

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
            bonusMode={inFreeSpins}
          />
        ))}
      </div>

      <AnimatePresence>
        {lastWin && <WinDisplay win={lastWin} nearMiss={nearMiss} />}
      </AnimatePresence>

      {inFreeSpins && (
        <div className="bonus-indicator">
          <Sparkles size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
          FREE SPINS: {bonusSpinsLeft}/{BONUS_SPINS} — {bonusMultiplier}x multiplier
        </div>
      )}

      <BetControls
        bet={bet}
        setBet={setBet}
        balance={balance}
        spinning={spinning || inOverlay}
        onSpin={() => handleSpin(false)}
        onBonusBuy={handleBonusBuy}
        bonusMode={inFreeSpins}
        autoSpin={autoSpin}
        onAutoSpinToggle={() => setAutoSpin(prev => !prev)}
        turbo={turbo}
        onTurboToggle={() => setTurbo(prev => !prev)}
      />

      {/* Bonus overlays */}
      <AnimatePresence>
        {bonusStage === 'picker' && <BonusPicker onResult={handlePickerResult} />}
        {bonusStage === 'wheel' && <BonusWheel onResult={handleWheelResult} />}
        {bonusStage === 'vault' && <VaultHeist bet={bonusBet} onComplete={(mult) => handleBonusGameComplete(mult, 'Vault Heist', '🔓')} />}
        {bonusStage === 'golden' && <GoldenRain bet={bonusBet} onComplete={(mult) => handleBonusGameComplete(mult, 'Golden Rain', '✨')} />}
        {bonusStage === 'scratch' && <ScratchCard bet={bonusBet} onComplete={(mult) => handleBonusGameComplete(mult, 'Scratch Card', '🎟️')} />}
      </AnimatePresence>

      {/* Win share overlay */}
      <AnimatePresence>
        {shareWin && (
          <WinShareOverlay
            amount={shareWin.amount}
            multiplier={shareWin.multiplier}
            username={username}
            game={shareWin.game}
            onDismiss={() => setShareWin(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
