import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import Particles from './Particles';

export default function BonusOverlay({ onComplete }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <motion.div
      className="bonus-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Particles count={50} type="confetti" />

      <motion.div
        className="bonus-overlay-content"
        initial={{ scale: 0, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.2 }}
      >
        <motion.div
          className="bonus-title"
          animate={{
            scale: [1, 1.1, 1],
            textShadow: [
              '0 0 20px rgba(255, 215, 0, 0.5)',
              '0 0 60px rgba(255, 215, 0, 1)',
              '0 0 20px rgba(255, 215, 0, 0.5)',
            ],
          }}
          transition={{ repeat: Infinity, duration: 1 }}
        >
          🃏 BONUS MODE 🃏
        </motion.div>

        <motion.div
          className="bonus-subtitle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          10 Free Spins with 3× Multiplier!
        </motion.div>

        <motion.div
          className="bonus-glow"
          animate={{
            boxShadow: [
              '0 0 50px rgba(255, 215, 0, 0.3)',
              '0 0 100px rgba(255, 215, 0, 0.6)',
              '0 0 50px rgba(255, 215, 0, 0.3)',
            ],
          }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />
      </motion.div>
    </motion.div>
  );
}
