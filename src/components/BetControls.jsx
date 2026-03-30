import { useState } from 'react';
import { Disc3, Zap, Play, FastForward } from 'lucide-react';
import { BET_PRESETS, MIN_BET, BONUS_BUY_MULTIPLIER } from '../utils/constants';

export default function BetControls({
  bet, setBet, balance, spinning, onSpin, onBonusBuy, bonusMode,
  autoSpin, onAutoSpinToggle, turbo, onTurboToggle,
}) {
  const [customBet, setCustomBet] = useState('');

  const handleCustomBet = (e) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomBet(val);
    const num = parseInt(val, 10);
    if (num >= MIN_BET) {
      setBet(num);
    }
  };

  const handlePreset = (amount) => {
    setBet(amount);
    setCustomBet('');
  };

  return (
    <div className="bet-controls">
      {!bonusMode && (
        <div className="bet-row">
          <span className="bet-label">Bet:</span>
          <div className="bet-buttons">
            {BET_PRESETS.map(amount => (
              <button
                key={amount}
                className={`bet-btn ${bet === amount && !customBet ? 'active' : ''}`}
                onClick={() => handlePreset(amount)}
                disabled={spinning || amount > balance}
              >
                {amount.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      )}

      {!bonusMode && (
        <div className="bet-row">
          <span className="bet-label">Custom:</span>
          <input
            type="text"
            inputMode="numeric"
            className="bet-custom-input"
            placeholder={`${bet.toLocaleString()}`}
            value={customBet}
            onChange={handleCustomBet}
            disabled={spinning}
          />
          <div className="balance-display">
            <span className="balance-label">Bal</span>
            <span className="balance-amount">{balance.toLocaleString()}</span>
            <span className="balance-pts">pts</span>
          </div>
        </div>
      )}

      {bonusMode && (
        <div className="bet-row">
          <div className="balance-display" style={{ marginLeft: 0 }}>
            <span className="balance-label">Bal</span>
            <span className="balance-amount">{balance.toLocaleString()}</span>
            <span className="balance-pts">pts</span>
          </div>
        </div>
      )}

      <div className="spin-row">
        <button
          className={`spin-btn ${bonusMode ? 'spin-btn-bonus' : ''}`}
          onClick={onSpin}
          disabled={spinning || (!bonusMode && (balance < bet || bet < MIN_BET))}
        >
          {spinning ? <span className="spinner" /> : bonusMode ? (
            <><Disc3 size={22} /> FREE SPIN</>
          ) : (
            <><Disc3 size={22} /> SPIN {bet.toLocaleString()}</>
          )}
        </button>

        {!bonusMode && (
          <button
            className="bonus-buy-btn"
            onClick={onBonusBuy}
            disabled={spinning || balance < bet * BONUS_BUY_MULTIPLIER}
            title={`Costs ${(bet * BONUS_BUY_MULTIPLIER).toLocaleString()} pts`}
          >
            <Zap size={16} /> Bonus {BONUS_BUY_MULTIPLIER}x
          </button>
        )}
      </div>

      {/* Autospin + Turbo row */}
      <div className="spin-options-row">
        <button
          className={`option-btn ${autoSpin ? 'option-active' : ''}`}
          onClick={onAutoSpinToggle}
          title={autoSpin ? 'Stop autospin' : 'Start autospin'}
        >
          <Play size={14} /> {autoSpin ? 'STOP' : 'AUTO'}
        </button>
        <button
          className={`option-btn ${turbo ? 'option-active' : ''}`}
          onClick={onTurboToggle}
          title={turbo ? 'Normal speed' : 'Turbo speed'}
        >
          <FastForward size={14} /> TURBO
        </button>
      </div>
    </div>
  );
}
