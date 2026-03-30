import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Particles from './Particles';

// This component listens for win events via BroadcastChannel API
// and displays them as an overlay in OBS browser source
export default function StreamOverlay() {
  const [currentWin, setCurrentWin] = useState(null);

  useEffect(() => {
    // Listen for win broadcasts from the main app
    const bc = new BroadcastChannel('streamslots_wins');
    bc.onmessage = (event) => {
      const win = event.data;
      setCurrentWin(win);
      // Auto-hide after display duration
      setTimeout(() => setCurrentWin(null), win.type === 'jackpot' ? 8000 : 5000);
    };

    return () => bc.close();
  }, []);

  return (
    <div className="stream-overlay">
      <AnimatePresence>
        {currentWin && (
          <motion.div
            className={`overlay-win overlay-${currentWin.type}`}
            initial={{ opacity: 0, y: -80, scale: 0.5 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            {(currentWin.type === 'jackpot' || currentWin.type === 'mega') && (
              <Particles count={40} type="confetti" />
            )}

            <div className="overlay-content">
              {currentWin.type === 'jackpot' && (
                <motion.div
                  className="overlay-title jackpot"
                  animate={{ scale: [1, 1.1, 1], rotate: [0, 2, -2, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                >
                  🏆 JACKPOT 🏆
                </motion.div>
              )}
              {currentWin.type === 'mega' && (
                <motion.div
                  className="overlay-title mega"
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 0.6 }}
                >
                  💎 MEGA WIN 💎
                </motion.div>
              )}
              {currentWin.type === 'big' && (
                <div className="overlay-title big">🎰 BIG WIN 🎰</div>
              )}

              <div className="overlay-user">{currentWin.username}</div>
              <div className="overlay-amount">+{currentWin.amount?.toLocaleString()} pts</div>
              {currentWin.multiplier && (
                <div className="overlay-multi">{currentWin.multiplier}× multiplier</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .stream-overlay {
          width: 100vw;
          height: 100vh;
          background: transparent;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 40px;
          overflow: hidden;
        }

        .overlay-win {
          text-align: center;
          padding: 24px 48px;
          border-radius: 16px;
          position: relative;
        }

        .overlay-jackpot {
          background: linear-gradient(135deg, rgba(255, 215, 0, 0.95), rgba(255, 165, 0, 0.95));
          border: 3px solid #fff;
          box-shadow: 0 0 60px rgba(255, 215, 0, 0.8), 0 0 120px rgba(255, 215, 0, 0.4);
        }

        .overlay-mega {
          background: linear-gradient(135deg, rgba(108, 52, 131, 0.95), rgba(142, 68, 173, 0.95));
          border: 2px solid #ffd700;
          box-shadow: 0 0 40px rgba(108, 52, 131, 0.6), 0 0 80px rgba(255, 215, 0, 0.3);
        }

        .overlay-big {
          background: linear-gradient(135deg, rgba(46, 204, 113, 0.9), rgba(39, 174, 96, 0.9));
          border: 2px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 0 30px rgba(46, 204, 113, 0.5);
        }

        .overlay-content {
          position: relative;
          z-index: 10;
        }

        .overlay-title {
          font-size: 2.5rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 4px;
          margin-bottom: 8px;
        }

        .overlay-title.jackpot {
          color: #000;
          text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
        }

        .overlay-title.mega {
          color: #ffd700;
          text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
        }

        .overlay-title.big {
          color: #fff;
        }

        .overlay-user {
          font-size: 1.4rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 4px;
        }

        .overlay-jackpot .overlay-user {
          color: rgba(0, 0, 0, 0.8);
        }

        .overlay-amount {
          font-size: 2.2rem;
          font-weight: 900;
          color: #fff;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        }

        .overlay-jackpot .overlay-amount {
          color: #000;
        }

        .overlay-multi {
          font-size: 1rem;
          color: rgba(255, 255, 255, 0.7);
          margin-top: 4px;
        }

        .overlay-jackpot .overlay-multi {
          color: rgba(0, 0, 0, 0.6);
        }
      `}</style>
    </div>
  );
}
