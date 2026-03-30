import { motion } from 'framer-motion';
import Particles from './Particles';

export default function WinDisplay({ win, nearMiss }) {
  if (!win) return null;

  const isMega = win.multiplier >= 25 || win.type === 'jackpot';
  const isBig = win.multiplier >= 10;

  return (
    <motion.div
      className={`win-display ${isMega ? 'mega-win' : isBig ? 'big-win' : 'normal-win'}`}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      {isMega && <Particles count={60} type="confetti" />}
      {isBig && !isMega && <Particles count={30} type="coins" />}

      {win.type === 'jackpot' && (
        <motion.div
          className="win-jackpot-text"
          animate={{ scale: [1, 1.2, 1], rotate: [0, 3, -3, 0] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
        >
          🏆 JACKPOT 🏆
        </motion.div>
      )}

      {isMega && win.type !== 'jackpot' && (
        <motion.div
          className="win-mega-text"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 0.6 }}
        >
          MEGA WIN
        </motion.div>
      )}

      {isBig && !isMega && (
        <div className="win-big-text">BIG WIN!</div>
      )}

      <motion.div
        className="win-amount"
        initial={{ scale: 0.5 }}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        +{win.amount?.toLocaleString()} pts
      </motion.div>

      <div className="win-label">{win.label}</div>

      {nearMiss && (
        <motion.div
          className="near-miss-text"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 2 }}
        >
          SO CLOSE!
        </motion.div>
      )}
    </motion.div>
  );
}
