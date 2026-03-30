import { useState, useCallback, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { User, Disc3, Trophy, History } from 'lucide-react';
import UserLogin from './components/UserLogin';
import AuthCallback from './components/AuthCallback';
import SlotMachine from './components/SlotMachine';
import TwitchEmbed from './components/TwitchEmbed';
import Leaderboard from './components/Leaderboard';
import SpinHistory from './components/SpinHistory';
import { ToastContainer, createToast } from './components/Toast';
import { useLocalStorage } from './hooks/useLocalStorage';
import { LS_KEYS, LEADERBOARD_MAX, HISTORY_MAX, JACKPOT_SEED, CHANNEL_NAME } from './utils/constants';
import { getChannelId } from './utils/api';
import './styles/app.css';

let historyId = 0;
let lbId = 0;

export default function App() {
  const [ready, setReady] = useState(false);
  const [configError, setConfigError] = useState('');
  const [username, setUsername] = useLocalStorage(LS_KEYS.USERNAME, '');
  const [displayName, setDisplayName] = useLocalStorage('se_slots_display', '');
  const [avatar, setAvatar] = useLocalStorage('se_slots_avatar', '');
  const [balance, setBalance] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState('slots'); // 'slots' | 'history' | 'leaderboard'

  const [leaderboard, setLeaderboard] = useLocalStorage(LS_KEYS.LEADERBOARD, []);
  const [history, setHistory] = useLocalStorage(LS_KEYS.HISTORY, []);
  const [jackpot, setJackpot] = useLocalStorage(LS_KEYS.JACKPOT, JACKPOT_SEED);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    getChannelId()
      .then(() => setReady(true))
      .catch(() => setConfigError('Could not connect to StreamElements. Check server config.'));
  }, []);

  const showToast = useCallback((message, type) => {
    const toast = createToast(message, type);
    setToasts(prev => [...prev.slice(-4), toast]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleLogin = useCallback((user, points, display, profileImg) => {
    setUsername(user);
    setDisplayName(display || user);
    setAvatar(profileImg || '');
    setBalance(points);
    setLoggedIn(true);
  }, [setUsername, setDisplayName, setAvatar]);

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
            <h2 className="setup-title">Connection Error</h2>
            <p className="setup-error">{configError}</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  if (!ready) {
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

  return (
    <div className="app">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback onLogin={handleLogin} />} />
        <Route path="*" element={
          !loggedIn ? (
            <>
              <div className="app-header">
                <h1 className="app-title"><Disc3 size={22} /> StreamSlots</h1>
              </div>
              <UserLogin />
            </>
          ) : (
            <>
              <div className="app-header">
                <h1 className="app-title"><Disc3 size={22} /> StreamSlots</h1>
                <div className="app-header-right">
                  {avatar && <img src={avatar} alt="" className="header-avatar" />}
                  <span className="header-user"><User size={16} /> {displayName}</span>
                </div>
              </div>

              <div className="app-layout">
                <div className="layout-stream">
                  <TwitchEmbed channel={CHANNEL_NAME} />
                </div>

                <div className="layout-right">
                  {/* Tab bar */}
                  <div className="tab-bar">
                    <button
                      className={`tab-btn ${tab === 'slots' ? 'tab-active' : ''}`}
                      onClick={() => setTab('slots')}
                    >
                      <Disc3 size={14} /> Slots
                    </button>
                    <button
                      className={`tab-btn ${tab === 'history' ? 'tab-active' : ''}`}
                      onClick={() => setTab('history')}
                    >
                      <History size={14} /> History
                    </button>
                    <button
                      className={`tab-btn ${tab === 'leaderboard' ? 'tab-active' : ''}`}
                      onClick={() => setTab('leaderboard')}
                    >
                      <Trophy size={14} /> Leaderboard
                    </button>
                  </div>

                  {/* Tab content */}
                  <div className="tab-content">
                    {tab === 'slots' && (
                      <div className="layout-slots">
                        <SlotMachine
                          balance={balance}
                          setBalance={setBalance}
                          username={username}
                          jackpot={jackpot}
                          setJackpot={setJackpot}
                          addHistory={addHistory}
                          addLeaderboardEntry={addLeaderboardEntry}
                          showToast={showToast}
                        />
                      </div>
                    )}
                    {tab === 'history' && (
                      <div className="tab-page">
                        <SpinHistory history={history} />
                      </div>
                    )}
                    {tab === 'leaderboard' && (
                      <div className="tab-page">
                        <Leaderboard
                          entries={leaderboard}
                          onReset={resetLeaderboard}
                          isStreamer={false}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )
        } />
      </Routes>
    </div>
  );
}
