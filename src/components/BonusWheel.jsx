import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { audio } from '../utils/audio';

const SLICES = [
  { multiplier: 100, color: '#F43F5E', label: '100x' },
  { multiplier: 10,  color: '#7C3AED', label: '10x' },
  { multiplier: 5,   color: '#06B6D4', label: '5x' },
  { multiplier: 3,   color: '#FBBF24', label: '3x' },
  { multiplier: 2,   color: '#34D399', label: '2x' },
];

// Hidden probabilities — tuned for 86% free spins RTP (94.6% overall bonus)
// E[mult] = 3.04, with 3 spins at 94.3% base RTP
const WEIGHTS = [
  { multiplier: 100, weight: 0.002 },  // 0.2%
  { multiplier: 10,  weight: 0.050 },  // 5%
  { multiplier: 5,   weight: 0.100 },  // 10%
  { multiplier: 3,   weight: 0.143 },  // 14.3%
  { multiplier: 2,   weight: 0.705 },  // 70.5%
];

function pickMultiplier() {
  const r = Math.random();
  let cumulative = 0;
  for (const w of WEIGHTS) {
    cumulative += w.weight;
    if (r <= cumulative) return w.multiplier;
  }
  return 2;
}

const SLICE_ANGLE = 360 / SLICES.length;

export default function BonusWheel({ onResult }) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);

  const handleSpin = useCallback(async () => {
    if (spinning || result) return;
    await audio.ensure();

    const chosen = pickMultiplier();
    setSpinning(true);

    const sliceIdx = SLICES.findIndex(s => s.multiplier === chosen);
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    const sliceCenter = sliceIdx * SLICE_ANGLE + SLICE_ANGLE / 2;
    const jitter = (Math.random() - 0.5) * (SLICE_ANGLE * 0.6);
    const targetAngle = fullSpins * 360 + (360 - sliceCenter) + jitter;

    setRotation(targetAngle);

    setTimeout(() => {
      setSpinning(false);
      setResult(chosen);
      audio.bonus();
      setTimeout(() => onResult(chosen), 1500);
    }, 4000);
  }, [spinning, result, onResult]);

  return (
    <div className="bonus-wheel-overlay">
      <div className="bonus-wheel-content">
        <h2 className="bonus-wheel-title">BONUS ROUND</h2>
        <p className="bonus-wheel-subtitle">
          {result ? `You got ${result}x!` : spinning ? 'Spinning...' : 'Spin the wheel for your multiplier!'}
        </p>

        <div className="wheel-wrapper">
          <div className="wheel-pointer">▼</div>

          <motion.div
            className="wheel"
            animate={{ rotate: rotation }}
            transition={{
              duration: 4,
              ease: [0.15, 0.85, 0.35, 1],
            }}
          >
            <svg viewBox="0 0 200 200" className="wheel-svg">
              {SLICES.map((slice, i) => {
                const startAngle = i * SLICE_ANGLE;
                const endAngle = startAngle + SLICE_ANGLE;
                const startRad = (startAngle - 90) * (Math.PI / 180);
                const endRad = (endAngle - 90) * (Math.PI / 180);
                const x1 = 100 + 95 * Math.cos(startRad);
                const y1 = 100 + 95 * Math.sin(startRad);
                const x2 = 100 + 95 * Math.cos(endRad);
                const y2 = 100 + 95 * Math.sin(endRad);
                const largeArc = SLICE_ANGLE > 180 ? 1 : 0;
                const midRad = ((startAngle + endAngle) / 2 - 90) * (Math.PI / 180);
                const textX = 100 + 60 * Math.cos(midRad);
                const textY = 100 + 60 * Math.sin(midRad);
                const textRotation = (startAngle + endAngle) / 2;

                return (
                  <g key={i}>
                    <path
                      d={`M100,100 L${x1},${y1} A95,95 0 ${largeArc},1 ${x2},${y2} Z`}
                      fill={slice.color}
                      stroke="rgba(0,0,0,0.3)"
                      strokeWidth="1"
                    />
                    <text
                      x={textX}
                      y={textY}
                      textAnchor="middle"
                      dominantBaseline="central"
                      transform={`rotate(${textRotation}, ${textX}, ${textY})`}
                      fill="#fff"
                      fontFamily="'Russo One', sans-serif"
                      fontSize="14"
                      fontWeight="bold"
                    >
                      {slice.label}
                    </text>
                  </g>
                );
              })}
              <circle cx="100" cy="100" r="18" fill="var(--void, #0B0B1A)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            </svg>
          </motion.div>
        </div>

        {/* Spin button — only before spinning */}
        {!spinning && !result && (
          <>
            <button className="wheel-spin-btn" onClick={handleSpin}>
              SPIN THE WHEEL
            </button>
            <div className="wheel-odds">
              {WEIGHTS.map(w => (
                <span key={w.multiplier} className="wheel-odds-item">
                  {w.multiplier}x <span className="wheel-odds-pct">{(w.weight * 100).toFixed(1)}%</span>
                </span>
              )).reverse()}
            </div>
          </>
        )}

        {/* Result display */}
        {result && (
          <motion.div
            className="wheel-result"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <span className="wheel-result-mult">{result}x</span>
            <span className="wheel-result-label">3 Free Spins!</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
