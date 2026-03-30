import { useState } from 'react';
import { Settings, Key, Tv } from 'lucide-react';

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
          <Settings size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
          Streamer Setup
        </h2>
        <p className="setup-desc">
          Connect your StreamElements account to enable point gambling.
        </p>

        <label className="setup-label" htmlFor="channel-input">
          <Tv size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Channel Name
          <input
            id="channel-input"
            type="text"
            value={ch}
            onChange={e => setCh(e.target.value)}
            placeholder="your_twitch_channel"
            className="setup-input"
            autoFocus
          />
        </label>

        <label className="setup-label" htmlFor="jwt-input">
          <Key size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> SE JWT Token
          <input
            id="jwt-input"
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
