import { BET_PRESETS, MAX_BET_PERCENT, MAX_BET_CAP, BONUS_BUY_MULTIPLIER } from '../utils/constants';

export default function BetControls({ bet, setBet, balance, spinning, onSpin, onBonusBuy, bonusMode }) {
  const maxBet = Math.min(Math.floor(balance * MAX_BET_PERCENT), MAX_BET_CAP);

  return (
    <div className="bet-controls">
      <div className="bet-row">
        <span className="bet-label">BET:</span>
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
          <span className="balance-label">BAL:</span>
          <span className="balance-amount">{balance.toLocaleString()}</span>
          <span className="balance-pts">pts</span>
        </div>
      </div>

      <div className="spin-row">
        <button
          className="spin-btn"
          onClick={onSpin}
          disabled={spinning || balance < bet || bonusMode}
        >
          {spinning ? <span className="spinner" /> : '🎰 SPIN'}
        </button>

        {!bonusMode && (
          <button
            className="bonus-buy-btn"
            onClick={onBonusBuy}
            disabled={spinning || balance < bet * BONUS_BUY_MULTIPLIER}
            title={`Costs ${(bet * BONUS_BUY_MULTIPLIER).toLocaleString()} pts`}
          >
            💥 Bonus Buy — {BONUS_BUY_MULTIPLIER}× bet
          </button>
        )}
      </div>
    </div>
  );
}
