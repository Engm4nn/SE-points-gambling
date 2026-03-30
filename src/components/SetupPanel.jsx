import { useState } from 'react';

export default function SetupPanel({ channel, jwt, onSave }) {
  const [ch, setCh] = useState(channel || '');
  const [token, setToken] = useState(jwt || '');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!ch.trim() || !token.trim()) {
      setError('Both fields are required');
      return;
    }
    setError('');
    onSave(ch.trim().toLowerCase(), token.trim());
  };

  return (
    <div className="setup-overlay">
      <form className="setup-panel" onSubmit={handleSubmit}>
        <h2 className="setup-title">
          <span className="setup-icon">⚙️</span> Streamer Setup
        </h2>
        <p className="setup-desc">
          Connect your StreamElements account to enable point gambling.
        </p>

        <label className="setup-label">
          Channel Name
          <input
            type="text"
            value={ch}
            onChange={e => setCh(e.target.value)}
            placeholder="your_twitch_channel"
            className="setup-input"
            autoFocus
          />
        </label>

        <label className="setup-label">
          SE JWT Token
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="Paste from SE Dashboard → Account → JWT"
            className="setup-input"
          />
        </label>

        {error && <p className="setup-error">{error}</p>}

        <button type="submit" className="setup-btn">
          Save &amp; Start
        </button>
      </form>
    </div>
  );
}
