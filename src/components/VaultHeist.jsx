import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { audio } from '../utils/audio';
import { Bomb, Gem, Lock } from 'lucide-react';

// 12 vaults: 6 values + 6 traps
// First 2 picks are GUARANTEED safe (shuffled among values only)
// Then remaining 4 values + 6 traps are shuffled
// RTP: ~94% with 10x bet cost, avg ~2.8 picks before trap
const VALUES = [1, 1, 2, 3, 5, 10];
const TRAP_COUNT = 6;
const GUARANTEED_SAFE = 2;
const VAULT_COUNT = VALUES.length + TRAP_COUNT;

function generateVaults() {
  // Shuffle all values
  const shuffledValues = [...VALUES].sort(() => Math.random() - 0.5);

  // First GUARANTEED_SAFE are safe values
  const guaranteed = shuffledValues.slice(0, GUARANTEED_SAFE).map(v => ({ type: 'value', amount: v }));

  // Remaining values + all traps, shuffled together
  const rest = [
    ...shuffledValues.slice(GUARANTEED_SAFE).map(v => ({ type: 'value', amount: v })),
    ...Array(TRAP_COUNT).fill(null).map(() => ({ type: 'trap', amount: 0 })),
  ];
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  return [...guaranteed, ...rest];
}

export default function VaultHeist({ bet, onComplete }) {
  const [vaults, setVaults] = useState(() => generateVaults());
  const [opened, setOpened] = useState(new Set());
  const [total, setTotal] = useState(0);
  const [hitTrap, setHitTrap] = useState(null);
  const [done, setDone] = useState(false);
  const [lastOpened, setLastOpened] = useState(null);

  const payout = Math.floor(bet * total);
  const allValuesFound = opened.size - (hitTrap !== null ? 0 : 0) >= VALUES.length;

  const handleOpen = useCallback((index) => {
    if (done || opened.has(index)) return;

    const vault = vaults[index];
    const newOpened = new Set(opened);
    newOpened.add(index);
    setOpened(newOpened);
    setLastOpened(index);

    if (vault.type === 'trap') {
      setHitTrap(index);
      setDone(true);
      audio.loss();
      // Finish with whatever was collected
      setTimeout(() => {
        onComplete(total);
      }, 2000);
    } else {
      const newTotal = total + vault.amount;
      setTotal(newTotal);
      audio.cardDeal();

      // Check if all values found
      const valuesOpened = [...newOpened].filter(i => vaults[i].type === 'value').length;
      if (valuesOpened >= VALUES.length) {
        setDone(true);
        audio.bonus();
        setTimeout(() => {
          onComplete(newTotal);
        }, 2000);
      }
    }
  }, [done, opened, vaults, total, onComplete]);

  return (
    <div className="vh-overlay">
      <div className="vh-content">
        <h2 className="vh-title">VAULT HEIST</h2>
        <p className="vh-subtitle">
          First 2 picks are safe! Then watch out for {TRAP_COUNT} traps.
        </p>

        {/* Running total */}
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

        {/* Vault grid: 4x3 */}
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
                layout
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

        {/* Status */}
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
          {done ? 'Returning to slots...' : `${VALUES.length - [...opened].filter(i => vaults[i].type === 'value').length} values left · ${TRAP_COUNT - (hitTrap !== null ? 1 : 0)} traps hidden`}
        </p>
      </div>
    </div>
  );
}
