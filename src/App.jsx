import { useState, useCallback, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { User, Disc3, Trophy, History, Gift, Heart, X } from 'lucide-react';
import UserLogin from './components/UserLogin';
import AuthCallback from './components/AuthCallback';
import SlotMachine from './components/SlotMachine';
import TwitchEmbed from './components/TwitchEmbed';
import Leaderboard from './components/Leaderboard';
import SpinHistory from './components/SpinHistory';
import { ToastContainer, createToast } from './components/Toast';
import { useLocalStorage } from './hooks/useLocalStorage';
import { LS_KEYS, HISTORY_MAX, CHANNEL_NAME } from './utils/constants';
import { getChannelId } from './utils/api';
import { fetchJackpot } from './utils/jackpotApi';
import { fetchLeaderboard } from './utils/leaderboardApi';
import { startVersionPolling } from './utils/versionCheck';
import './styles/app.css';

let historyId = 0;

export default function App() {
  const [ready, setReady] = useState(false);
  const [configError, setConfigError] = useState('');
  const [username, setUsername] = useLocalStorage(LS_KEYS.USERNAME, '');
  const [displayName, setDisplayName] = useLocalStorage('se_slots_display', '');
  const [avatar, setAvatar] = useLocalStorage('se_slots_avatar', '');
  const [balance, setBalance] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState('slots');
  const [showDeposit, setShowDeposit] = useState(false);

  const [leaderboard, setLeaderboard] = useState([]);
  const [history, setHistory] = useLocalStorage(LS_KEYS.HISTORY, []);
  const [jackpot, setJackpot] = useState(5000);
  const [toasts, setToasts] = useState([]);

  // Init: check SE connection, fetch global jackpot, start version polling
  useEffect(() => {
    Promise.all([
      getChannelId(),
      fetchJackpot().then(j => setJackpot(j)),
    ])
      .then(() => setReady(true))
      .catch(() => setConfigError('Could not connect. Check server config.'));

    startVersionPolling();
  }, []);

  // Refresh leaderboard periodically
  useEffect(() => {
    if (!ready) return;
    const load = () => fetchLeaderboard('top3', 10).then(setLeaderboard).catch(() => {});
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [ready]);

  // Refresh jackpot periodically
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(() => {
      fetchJackpot().then(j => setJackpot(j)).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [ready]);

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
            <p className="setup-desc" style={{ marginTop: 16 }}>Connecting...</p>
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
                  <div className="deposit-wrapper">
                    <button className="deposit-btn-nav" onClick={() => setShowDeposit(prev => !prev)}>
                      <Gift size={15} /> Get Points
                    </button>
                    {showDeposit && (
                      <div className="deposit-dropdown">
                        <button className="deposit-close" onClick={() => setShowDeposit(false)} aria-label="Close"><X size={14} /></button>
                        <p className="deposit-info">Earn <strong>1,000 pts</strong> per sub or gifted sub!</p>
                        <div className="deposit-links">
                          <a href={`https://www.twitch.tv/subs/${CHANNEL_NAME}`} target="_blank" rel="noopener noreferrer" className="deposit-link deposit-sub">
                            <Heart size={14} /> Subscribe
                          </a>
                          <a href={`https://www.twitch.tv/subs/${CHANNEL_NAME}`} target="_blank" rel="noopener noreferrer" className="deposit-link deposit-gift">
                            <Gift size={14} /> Gift a Sub
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                  {avatar && <img src={avatar} alt="" className="header-avatar" />}
                  <span className="header-user"><User size={16} /> {displayName}</span>
                </div>
              </div>

              <div className="app-layout">
                <div className="layout-stream">
                  <TwitchEmbed channel={CHANNEL_NAME} />
                </div>

                <div className="layout-right">
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
                        <Leaderboard entries={leaderboard} />
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
