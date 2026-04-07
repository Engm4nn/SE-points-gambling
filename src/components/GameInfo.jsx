import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

const INFO = {
  slots: {
    title: 'Slots',
    rtp: '94.3%',
    rows: [
      ['3× 7️⃣', 'JACKPOT'],
      ['3× 💎', '40×'],
      ['3× 🔔', '15×'],
      ['3× 🍒', '8×'],
      ['3× Any', '5×'],
      ['2× 7️⃣', '4×'],
      ['2× 💎', '3×'],
      ['2× Any', '1.55×'],
      ['No match', '0×'],
    ],
    notes: 'Jackpot grows from 1% of losses + 10 pts/min. Hit 3× 7️⃣ to win it. Bonus: triggers Vault Heist — pick from 12 vaults to add multipliers, avoid 6 traps!',
  },
  gates: {
    title: 'Gates of Olympus',
    rtp: '~95%',
    rows: [
      ['👑 ×12+', '50×'],
      ['🏆 ×12+', '35×'],
      ['💍 ×12+', '25×'],
      ['⏳ ×12+', '16×'],
      ['💛 ×12+', '12×'],
      ['🔴/💙 ×8+', '0.6×–7×'],
      ['💜/💚 ×8+', '0.4×–5×'],
      ['⚡ ×4+', 'Free Spins (15)'],
    ],
    notes: '6×5 grid, Pay Anywhere — 8+ matching symbols anywhere = win. Winning symbols vanish and new ones tumble in. Multiplier orbs appear during tumbles (more frequent and bigger in Free Spins!). In Free Spins, multipliers accumulate across all spins! Bonus Buy: 100× bet.',
  },
  blackjack: {
    title: 'Blackjack',
    rtp: '~99.5%',
    rows: [
      ['Blackjack (21)', '2.5×'],
      ['Win', '2×'],
      ['Push (tie)', '1× (bet returned)'],
      ['Lose', '0×'],
      ['Double Down', '2× bet, one card'],
    ],
    notes: 'Standard rules. Dealer stands on 17. No splitting. Double down on first two cards only.',
  },
  roulette: {
    title: 'Roulette',
    rtp: '97.3%',
    rows: [
      ['Single number', '36×'],
      ['Red / Black', '2×'],
      ['Odd / Even', '2×'],
      ['1-18 / 19-36', '2×'],
    ],
    notes: 'European single-zero wheel (37 numbers). You can place multiple bets per spin. House edge comes from the green 0.',
  },
  mines: {
    title: 'Mines',
    rtp: '97%',
    rows: [
      ['1 mine', 'Low risk, small multipliers'],
      ['3 mines', 'Moderate risk'],
      ['5 mines', 'Higher multipliers'],
      ['10 mines', 'High risk, big multipliers'],
      ['24 mines', 'Extreme — 24.25× per tile'],
    ],
    notes: '5×5 grid with hidden mines. Click tiles to reveal safe ones — each safe tile increases your multiplier. Cash out anytime to lock in your winnings, or hit a mine and lose your bet. More mines = higher multipliers but more danger.',
  },
  coinflip: {
    title: 'Coin Flip',
    rtp: '100%',
    rows: [
      ['Win (correct call)', '2×'],
      ['Lose (wrong call)', '0×'],
    ],
    notes: 'Pick Heads or Tails, place your bet, and flip the coin. 50/50 chance — correct call pays 2× your bet. Max bet: 10,000 pts.',
  },
};

export default function GameInfo({ game }) {
  const [open, setOpen] = useState(false);
  const info = INFO[game];
  if (!info) return null;

  return (
    <>
      <button className="game-info-btn" onClick={() => setOpen(true)} title="Game info & odds" aria-label="Game info">
        <HelpCircle size={16} />
      </button>

      {open && (
        <div className="game-info-overlay" onClick={() => setOpen(false)}>
          <div className="game-info-panel" onClick={e => e.stopPropagation()}>
            <button className="game-info-close" onClick={() => setOpen(false)} aria-label="Close">
              <X size={16} />
            </button>

            <h3 className="game-info-title">{info.title}</h3>
            <div className="game-info-rtp">RTP: {info.rtp}</div>

            <table className="game-info-table">
              <thead>
                <tr><th>Result</th><th>Payout</th></tr>
              </thead>
              <tbody>
                {info.rows.map(([label, payout], i) => (
                  <tr key={i}><td>{label}</td><td>{payout}</td></tr>
                ))}
              </tbody>
            </table>

            <p className="game-info-notes">{info.notes}</p>
          </div>
        </div>
      )}
    </>
  );
}
