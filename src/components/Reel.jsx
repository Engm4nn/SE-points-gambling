import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, useMotionValue, useSpring, animate } from 'framer-motion';
import { SYMBOLS, BONUS_SYMBOL, VISIBLE_ROWS, SYMBOLS_PER_STRIP } from '../utils/constants';
import { generateReelStrip } from '../utils/slotLogic';
import { audio } from '../utils/audio';

const SYMBOL_HEIGHT = 80;
const TOTAL_HEIGHT = SYMBOLS_PER_STRIP * SYMBOL_HEIGHT;

export default function Reel({ spinning, targetSymbol, delay, onStop, reelIndex, bonusMode }) {
  const [strip, setStrip] = useState(() => generateReelStrip());
  const y = useMotionValue(0);
  const containerRef = useRef(null);
  const hasStoppedRef = useRef(false);

  // Generate new strip each spin
  useEffect(() => {
    if (spinning) {
      hasStoppedRef.current = false;
      setStrip(generateReelStrip());
    }
  }, [spinning]);

  useEffect(() => {
    if (spinning) {
      // Fast spin phase
      const spinSpeed = -6000; // px/s
      let startTime = null;
      let animFrame;

      const spinLoop = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        y.set((elapsed * spinSpeed / 1000) % TOTAL_HEIGHT);
        animFrame = requestAnimationFrame(spinLoop);
      };

      animFrame = requestAnimationFrame(spinLoop);

      // Stop after delay
      const stopTimeout = setTimeout(() => {
        cancelAnimationFrame(animFrame);

        // Calculate target position to land on target symbol
        // Place target in the middle visible row
        const middleRow = Math.floor(VISIBLE_ROWS / 2);
        // Find or place target symbol in strip
        const targetIdx = Math.min(strip.length - 1, Math.floor(strip.length / 2));
        strip[targetIdx] = { ...targetSymbol };
        setStrip([...strip]);

        const targetY = -(targetIdx - middleRow) * SYMBOL_HEIGHT;

        // Spring settle animation
        animate(y, targetY, {
          type: 'spring',
          stiffness: 200,
          damping: 25,
          mass: 1,
          onComplete: () => {
            if (!hasStoppedRef.current) {
              hasStoppedRef.current = true;
              audio.reelStop();
              onStop?.(reelIndex);
            }
          },
        });
      }, delay);

      return () => {
        cancelAnimationFrame(animFrame);
        clearTimeout(stopTimeout);
      };
    }
  }, [spinning, delay, targetSymbol, strip, onStop, reelIndex]);

  const glowClass = bonusMode ? 'reel-glow-bonus' : spinning ? 'reel-glow-spin' : '';

  return (
    <div className={`reel-container ${glowClass}`} ref={containerRef}>
      <div className="reel-mask">
        <motion.div className="reel-strip" style={{ y }}>
          {strip.map((sym, i) => (
            <div
              key={i}
              className={`reel-symbol ${bonusMode ? 'bonus-symbol' : ''}`}
              style={{ height: SYMBOL_HEIGHT }}
            >
              <span className="symbol-emoji">{sym.emoji}</span>
            </div>
          ))}
        </motion.div>
      </div>
      {/* Active line indicator */}
      <div className="reel-active-line" />
    </div>
  );
}
