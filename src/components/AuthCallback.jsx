import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseAuthCallback, getTwitchUser } from '../utils/twitch';
import { authenticate, fetchPoints } from '../utils/api';
import { Disc3 } from 'lucide-react';

export default function AuthCallback({ onLogin }) {
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function handleAuth() {
      const token = parseAuthCallback();
      if (!token) {
        setError('No access token received from Twitch.');
        return;
      }

      try {
        const twitchUser = await getTwitchUser(token);

        await authenticate(token);

        const points = await fetchPoints();
        onLogin(twitchUser.login, points, twitchUser.displayName, twitchUser.profileImage);
        navigate('/', { replace: true });
      } catch (err) {
        setError('Login failed. Please try again.');
      }
    }

    handleAuth();
  }, [onLogin, navigate]);

  if (error) {
    return (
      <div className="setup-overlay">
        <div className="setup-panel">
          <h2 className="setup-title">Login Error</h2>
          <p className="setup-error">{error}</p>
          <a href="/" className="setup-btn">Back to Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-overlay">
      <div className="setup-panel" style={{ textAlign: 'center' }}>
        <Disc3 size={32} style={{ color: 'var(--phosphor)', marginBottom: 12 }} />
        <span className="spinner" />
        <p className="setup-desc" style={{ marginTop: 16 }}>Logging in with Twitch...</p>
      </div>
    </div>
  );
}
