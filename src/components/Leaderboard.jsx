import { Crown, Medal } from 'lucide-react';

export default function Leaderboard({ entries }) {
  return (
    <div className="leaderboard">
      <div className="leaderboard-header">
        <h3>Top Wagerers</h3>
      </div>

      {entries.length === 0 ? (
        <div className="lb-empty">No wagers yet</div>
      ) : (
        <div className="lb-list">
          {entries.map((entry, i) => (
            <div key={entry.username} className={`lb-entry ${i === 0 ? 'lb-first' : ''}`}>
              <span className="lb-rank">
                {i === 0 ? <Crown size={16} style={{ color: '#FBBF24' }} /> :
                 i === 1 ? <Medal size={14} style={{ color: '#94A3B8' }} /> :
                 i === 2 ? <Medal size={14} style={{ color: '#D97706' }} /> :
                 `#${i + 1}`}
              </span>
              <span className="lb-user">{entry.username}</span>
              <span className="lb-amount">{Number(entry.total_wagered).toLocaleString()} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
