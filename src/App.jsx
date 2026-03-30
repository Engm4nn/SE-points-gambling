import { useState, useCallback, useEffect } from 'react';
import { User, Disc3 } from 'lucide-react';
import UserLogin from './components/UserLogin';
import SlotMachine from './components/SlotMachine';
import TwitchEmbed from './components/TwitchEmbed';
import Leaderboard from './components/Leaderboard';
import SpinHistory from './components/SpinHistory';
import { ToastContainer, createToast } from './components/Toast';
import { useLocalStorage } from './hooks/useLocalStorage';
import { LS_KEYS, LEADERBOARD_MAX, HISTORY_MAX, JACKPOT_SEED, CHANNEL_NAME, SE_JWT } from './utils/constants';
import { getChannelId } from './utils/api';
import './styles/app.css';

let historyId = 0;
let lbId = 0;

export default function App() {
  const [channelId, setChannelId] = useState('');
  const [configError, setConfigError] = useState('');
  const [username, setUsername] = useLocalStorage(LS_KEYS.USERNAME, '');
  const [balance, setBalance] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);

  const [leaderboard, setLeaderboard] = useLocalStorage(LS_KEYS.LEADERBOARD, []);
  const [history, setHistory] = useLocalStorage(LS_KEYS.HISTORY, []);
  const [jackpot, setJackpot] = useLocalStorage(LS_KEYS.JACKPOT, JACKPOT_SEED);
  const [toasts, setToasts] = useState([]);

  // Resolve channel name → SE channel ID on mount
  useEffect(() => {
    if (!CHANNEL_NAME || !SE_JWT) {
      setConfigError('Missing VITE_CHANNEL_NAME or VITE_SE_JWT environment variables.');
      return;
    }
    getChannelId(CHANNEL_NAME, SE_JWT)
      .then(id => setChannelId(id))
      .catch(() => setConfigError('Could not resolve StreamElements channel. Check env vars.'));
  }, []);

  const showToast = useCallback((message, type) => {
    const toast = createToast(message, type);
    setToasts(prev => [...prev.slice(-4), toast]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleLogin = useCallback((user, points) => {
    setUsername(user);
    setBalance(points);
    setLoggedIn(true);
  }, [setUsername]);

  const addHistory = useCallback((symbols, net, type) => {
    const entry = { id: ++historyId, symbols, net, type, timestamp: Date.now() };
    setHistory(prev => [entry, ...prev].slice(0, HISTORY_MAX));
  }, [setHistory]);

  const addLeaderboardEntry = useCallback((user, amount, label) => {
    const entry = { id: ++lbId, username: user, amount, label, timestamp: Date.now() };
    setLeaderboard(prev => {
      const next = [...prev, entry].sort((a, b) => b.amount - a.amount).slice(0, LEADERBOARD_MAX);
      return next;
    });
  }, [setLeaderboard]);

  const resetLeaderboard = useCallback(() => {
    setLeaderboard([]);
  }, [setLeaderboard]);

  // Config error
  if (configError) {
    return (
      <div className="app">
        <div className="app-header">
          <h1 className="app-title"><Disc3 size={22} /> StreamSlots</h1>
        </div>
        <div className="setup-overlay">
          <div className="setup-panel">
            <h2 className="setup-title">Configuration Error</h2>
            <p className="setup-error">{configError}</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading channel ID
  if (!channelId) {
    return (
      <div className="app">
        <div className="app-header">
          <h1 className="app-title"><Disc3 size={22} /> StreamSlots</h1>
        </div>
        <div className="setup-overlay">
          <div className="setup-panel" style={{ textAlign: 'center' }}>
            <span className="spinner" />
            <p className="setup-desc" style={{ marginTop: 16 }}>Connecting to StreamElements...</p>
          </div>
        </div>
      </div>
    );
  }

  // Login
  if (!loggedIn) {
    return (
      <div className="app">
        <div className="app-header">
          <h1 className="app-title"><Disc3 size={22} /> StreamSlots</h1>
        </div>
        <UserLogin channelId={channelId} jwt={SE_JWT} onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="app">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="app-header">
        <h1 className="app-title"><Disc3 size={22} /> StreamSlots</h1>
        <div className="app-header-right">
          <span className="header-user"><User size={16} /> {username}</span>
        </div>
      </div>

      <div className="app-layout">
        <div className="layout-stream">
          <TwitchEmbed channel={CHANNEL_NAME} />
        </div>

        <div className="layout-bottom">
          <div className="layout-slots">
            <SlotMachine
              balance={balance}
              setBalance={setBalance}
              channelId={channelId}
              username={username}
              jwt={SE_JWT}
              jackpot={jackpot}
              setJackpot={setJackpot}
              addHistory={addHistory}
              addLeaderboardEntry={addLeaderboardEntry}
              showToast={showToast}
            />
          </div>

          <div className="layout-sidebar">
            <Leaderboard
              entries={leaderboard}
              onReset={resetLeaderboard}
              isStreamer={false}
            />
            <SpinHistory history={history} />
          </div>
        </div>
      </div>
    </div>
  );
}
