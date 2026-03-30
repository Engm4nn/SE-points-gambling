import { motion, AnimatePresence } from 'framer-motion';

export default function SpinHistory({ history }) {
  return (
    <div className="spin-history">
      <h3>📜 Spin History</h3>

      {history.length === 0 ? (
        <div className="sh-empty">No spins yet</div>
      ) : (
        <div className="sh-list">
          <AnimatePresence initial={false}>
            {history.map((entry, i) => (
              <motion.div
                key={entry.id}
                className={`sh-entry sh-${entry.type}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <span className="sh-symbols">
                  {entry.symbols.map(s => s.emoji).join(' ')}
                </span>
                <span className={`sh-result ${entry.net >= 0 ? 'sh-positive' : 'sh-negative'}`}>
                  {entry.net >= 0 ? '+' : ''}{entry.net.toLocaleString()} pts
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
