import { useState } from 'react';
import { fetchPoints } from '../utils/api';

export default function UserLogin({ channel, jwt, onLogin }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    setError('');

    try {
      const points = await fetchPoints(channel, username.trim().toLowerCase(), jwt);
      onLogin(username.trim().toLowerCase(), points);
    } catch (err) {
      setError('Could not fetch points. Check username and JWT.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay">
      <form className="login-panel" onSubmit={handleSubmit}>
        <h2 className="login-title">🎰 StreamSlots</h2>
        <p className="login-desc">
          Enter your Twitch username to start gambling with SE points.
        </p>

        <label className="setup-label">
          Twitch Username
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="your_username"
            className="setup-input"
            autoFocus
          />
        </label>

        {error && <p className="setup-error">{error}</p>}

        <button type="submit" className="setup-btn" disabled={loading}>
          {loading ? <span className="spinner" /> : 'Fetch Points & Play'}
        </button>
      </form>
    </div>
  );
}
