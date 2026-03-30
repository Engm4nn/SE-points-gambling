import { motion, AnimatePresence } from 'framer-motion';

export default function Leaderboard({ entries, onReset, isStreamer }) {
  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <h3>🏆 Leaderboard</h3>
        {isStreamer && entries.length > 0 && (
          <button className="lb-reset-btn" onClick={onReset} title="Reset leaderboard">
            ↻
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="lb-empty">No wins yet — be the first!</div>
      ) : (
        <div className="lb-list">
          <AnimatePresence>
            {entries.map((entry, i) => (
              <motion.div
                key={entry.id}
                className={`lb-entry ${i === 0 ? 'lb-first' : ''}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.05 }}
              >
                <span className="lb-rank">
                  {i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                <span className="lb-user">{entry.username}</span>
                <span className="lb-amount">+{entry.amount.toLocaleString()}</span>
                <span className="lb-multi">{entry.label}</span>
                <span className="lb-time">{formatTime(entry.timestamp)}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
