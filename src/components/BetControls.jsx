import { Disc3, Zap } from 'lucide-react';
import { BET_PRESETS, MAX_BET_PERCENT, MAX_BET_CAP, BONUS_BUY_MULTIPLIER } from '../utils/constants';

export default function BetControls({ bet, setBet, balance, spinning, onSpin, onBonusBuy, bonusMode }) {
  const maxBet = Math.min(Math.floor(balance * MAX_BET_PERCENT), MAX_BET_CAP);

  return (
    <div className="bet-controls">
      <div className="bet-row">
        <span className="bet-label">Bet:</span>
        <div className="bet-buttons">
          {BET_PRESETS.map(amount => (
            <button
              key={amount}
              className={`bet-btn ${bet === amount ? 'active' : ''}`}
              onClick={() => setBet(amount)}
              disabled={spinning || amount > balance}
            >
              {amount.toLocaleString()}
            </button>
          ))}
          <button
            className={`bet-btn ${bet === maxBet ? 'active' : ''}`}
            onClick={() => setBet(maxBet)}
            disabled={spinning || maxBet <= 0}
          >
            MAX
          </button>
        </div>
        <div className="balance-display">
          <span className="balance-label">Bal</span>
          <span className="balance-amount">{balance.toLocaleString()}</span>
          <span className="balance-pts">pts</span>
        </div>
      </div>

      <div className="spin-row">
        <button
          className="spin-btn"
          onClick={onSpin}
          disabled={spinning || balance < bet || bonusMode}
          aria-label="Spin"
        >
          {spinning ? <span className="spinner" /> : <><Disc3 size={24} /> SPIN</>}
        </button>

        {!bonusMode && (
          <button
            className="bonus-buy-btn"
            onClick={onBonusBuy}
            disabled={spinning || balance < bet * BONUS_BUY_MULTIPLIER}
            title={`Costs ${(bet * BONUS_BUY_MULTIPLIER).toLocaleString()} pts`}
            aria-label="Buy bonus"
          >
            <Zap size={18} /> Bonus Buy — {BONUS_BUY_MULTIPLIER}x
          </button>
        )}
      </div>
    </div>
  );
}
