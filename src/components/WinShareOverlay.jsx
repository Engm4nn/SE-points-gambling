import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';
import { sendChatMessage, formatWinMessage } from '../utils/chatBot';

export default function WinShareOverlay({ amount, multiplier, username, game, onDismiss }) {
  const [shared, setShared] = useState(false);

  const winType = multiplier >= 25 ? 'mega' : multiplier >= 10 ? 'big' : 'win';
  const badge = multiplier >= 25 ? 'MEGA WIN' : multiplier >= 10 ? 'BIG WIN' : 'NICE WIN';
  const canShare = multiplier >= 25 && amount > 0;

  const handleShare = () => {
    if (shared || !canShare) return;
    const siteUrl = window.location.origin;
    const msg = formatWinMessage(username, amount, multiplier, winType, siteUrl);
    sendChatMessage(msg);
    setShared(true);
  };

  return (
    <motion.div
      className="win-share-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="win-share-panel"
        initial={{ scale: 0.5, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <button className="win-share-close" onClick={onDismiss} aria-label="Close">
          <X size={16} />
        </button>

        <div className="win-share-badge">{badge}</div>

        <motion.div
          className="win-share-amount"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
        >
          +{amount.toLocaleString()}
        </motion.div>

        <div className="win-share-mult">{multiplier.toFixed(1)}x</div>

        {game && <div className="win-share-game">{game}</div>}

        {canShare && (
          <button
            className={`win-share-btn ${shared ? 'win-share-done' : ''}`}
            onClick={handleShare}
            disabled={shared}
          >
            <MessageSquare size={16} />
            {shared ? 'Shared!' : 'Share in Chat'}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}
