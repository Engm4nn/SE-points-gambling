import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { audio } from '../utils/audio';
import { Bomb, Lock } from 'lucide-react';

// 12 vaults: 6 values + 6 traps
// First 2 picks are GUARANTEED safe — if player clicks a trap,
// it gets swapped with an unrevealed value vault behind the scenes.
// RTP: ~94% with 10x bet cost, avg ~2.8 picks before trap
const VALUES = [1, 1, 2, 3, 5, 10];
const TRAP_COUNT = 6;
const GUARANTEED_SAFE = 2;
const VAULT_COUNT = VALUES.length + TRAP_COUNT;

function generateVaults() {
  const vaults = [
    ...VALUES.map(v => ({ type: 'value', amount: v })),
    ...Array(TRAP_COUNT).fill(null).map(() => ({ type: 'trap', amount: 0 })),
  ];
  // Fisher-Yates shuffle
  for (let i = vaults.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [vaults[i], vaults[j]] = [vaults[j], vaults[i]];
  }
  return vaults;
}

export default function VaultHeist({ bet, onComplete }) {
  const [vaults, setVaults] = useState(() => generateVaults());
  const [opened, setOpened] = useState(new Set());
  const [total, setTotal] = useState(0);
  const [hitTrap, setHitTrap] = useState(null);
  const [done, setDone] = useState(false);
  const [lastOpened, setLastOpened] = useState(null);
  const pickCount = useRef(0);

  const payout = Math.floor(bet * total);

  const handleOpen = useCallback((index) => {
    if (done || opened.has(index)) return;

    let currentVaults = [...vaults];
    let vault = currentVaults[index];

    // Guaranteed safe: if within first 2 picks and they hit a trap,
    // swap it with a random unrevealed value vault
    if (pickCount.current < GUARANTEED_SAFE && vault.type === 'trap') {
      // Find an unrevealed value vault to swap with
      const swapCandidates = currentVaults
        .map((v, idx) => ({ v, idx }))
        .filter(({ v, idx }) => v.type === 'value' && !opened.has(idx) && idx !== index);

      if (swapCandidates.length > 0) {
        const swapTarget = swapCandidates[Math.floor(Math.random() * swapCandidates.length)];
        // Swap contents
        currentVaults[index] = swapTarget.v;
        currentVaults[swapTarget.idx] = vault;
        setVaults(currentVaults);
        vault = currentVaults[index]; // now it's a value
      }
    }

    pickCount.current += 1;
    const newOpened = new Set(opened);
    newOpened.add(index);
    setOpened(newOpened);
    setLastOpened(index);

    if (vault.type === 'trap') {
      setHitTrap(index);
      setDone(true);
      audio.loss();
      setTimeout(() => {
        onComplete(total);
      }, 2000);
    } else {
      const newTotal = total + vault.amount;
      setTotal(newTotal);
      audio.cardDeal();

      // Check if all values found
      const valuesOpened = [...newOpened].filter(i => currentVaults[i].type === 'value').length;
      if (valuesOpened >= VALUES.length) {
        setDone(true);
        audio.bonus();
        setTimeout(() => {
          onComplete(newTotal);
        }, 2000);
      }
    }
  }, [done, opened, vaults, total, onComplete]);

  const safePicks = Math.max(0, GUARANTEED_SAFE - pickCount.current);

  return (
    <div className="vh-overlay">
      <div className="vh-content">
        <h2 className="vh-title">VAULT HEIST</h2>
        <p className="vh-subtitle">
          {safePicks > 0
            ? `${safePicks} safe pick${safePicks > 1 ? 's' : ''} remaining! Then watch out for traps.`
            : `${TRAP_COUNT} traps hidden among the remaining vaults!`}
        </p>

        <div className="vh-total">
          <span className="vh-total-label">Total</span>
          <motion.span
            className="vh-total-amount"
            key={total}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
          >
            {total}x
          </motion.span>
          <span className="vh-total-payout">= {payout.toLocaleString()} pts</span>
        </div>

        <div className="vh-grid">
          {vaults.map((vault, i) => {
            const isOpened = opened.has(i);
            const isTrap = isOpened && vault.type === 'trap';
            const isValue = isOpened && vault.type === 'value';
            const isLast = lastOpened === i;

            return (
              <motion.button
                key={i}
                className={`vh-vault ${isOpened ? (isTrap ? 'vh-trap' : 'vh-value') : ''} ${isLast && !done ? 'vh-last' : ''}`}
                onClick={() => !done && handleOpen(i)}
                disabled={isOpened || done}
                whileTap={!isOpened && !done ? { scale: 0.9 } : {}}
              >
                {!isOpened && <Lock size={20} />}
                {isTrap && <Bomb size={20} />}
                {isValue && (
                  <span className="vh-vault-value">+{vault.amount}x</span>
                )}
              </motion.button>
            );
          })}
        </div>

        {done && (
          <motion.div
            className={`vh-result ${hitTrap !== null ? 'vh-result-trap' : 'vh-result-clear'}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {hitTrap !== null ? (
              <span>TRAPPED! Collected {total}x = {payout.toLocaleString()} pts</span>
            ) : (
              <span>ALL VAULTS CLEARED! {total}x = {payout.toLocaleString()} pts</span>
            )}
          </motion.div>
        )}

        <p className="vh-hint">
          {done ? 'Returning to slots...' : `${VALUES.length - [...opened].filter(i => vaults[i].type === 'value').length} values left`}
        </p>
      </div>
    </div>
  );
}
