import { motion } from 'framer-motion';
import { useMemo } from 'react';

const CONFETTI_COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF69B4'];
const COIN_EMOJIS = ['🪙', '💰', '✨', '⭐'];

export default function Particles({ count = 30, type = 'confetti' }) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.5 + Math.random() * 2,
      size: type === 'confetti' ? 6 + Math.random() * 8 : 16 + Math.random() * 16,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      emoji: COIN_EMOJIS[Math.floor(Math.random() * COIN_EMOJIS.length)],
      rotation: Math.random() * 720 - 360,
      xDrift: (Math.random() - 0.5) * 200,
    }));
  }, [count, type]);

  return (
    <div className="particles-container">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="particle"
          style={{
            left: `${p.x}%`,
            top: '-10%',
            width: type === 'confetti' ? p.size : 'auto',
            height: type === 'confetti' ? p.size * 0.6 : 'auto',
            backgroundColor: type === 'confetti' ? p.color : 'transparent',
            borderRadius: type === 'confetti' ? '2px' : 0,
            fontSize: type === 'coins' ? `${p.size}px` : undefined,
          }}
          initial={{ opacity: 1, y: 0, x: 0, rotate: 0 }}
          animate={{
            opacity: [1, 1, 0],
            y: [0, window.innerHeight * 0.8],
            x: p.xDrift,
            rotate: p.rotation,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'easeOut',
          }}
        >
          {type === 'coins' && p.emoji}
        </motion.div>
      ))}
    </div>
  );
}
