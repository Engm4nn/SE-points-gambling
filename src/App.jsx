import { useState, useCallback, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { User, Disc3, Trophy, History, Gift, Heart, X, RefreshCw, Coins } from 'lucide-react';
import { fetchPoints } from './utils/api';
import UserLogin from './components/UserLogin';
import AuthCallback from './components/AuthCallback';
import GameSelector from './components/GameSelector';
import SlotMachine from './components/SlotMachine';
import Blackjack from './components/Blackjack';
import Roulette from './components/Roulette';
import Mines from './components/Mines';
import GameInfo from './components/GameInfo';
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
  const [activeGame, setActiveGame] = useState('slots');
  const [tab, setTab] = useState('game'); // 'game' | 'history' | 'leaderboard'
  const [showDeposit, setShowDeposit] = useState(false);
  const [lbRefreshing, setLbRefreshing] = useState(false);
  const [balRefreshing, setBalRefreshing] = useState(false);

  const [leaderboard, setLeaderboard] = useState([]);
  const [history, setHistory] = useLocalStorage(LS_KEYS.HISTORY, []);
  const [jackpot, setJackpot] = useState(5000);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    Promise.all([
      getChannelId(),
      fetchJackpot().then(j => setJackpot(j)),
    ])
      .then(() => setReady(true))
      .catch(() => setConfigError('Could not connect. Check server config.'));
    startVersionPolling();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const load = () => fetchLeaderboard('all', 50).then(setLeaderboard).catch(() => {});
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [ready]);

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

  const refreshLeaderboard = useCallback(async () => {
    setLbRefreshing(true);
    try {
      const data = await fetchLeaderboard('all', 50);
      setLeaderboard(data);
    } catch {}
    setLbRefreshing(false);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (balRefreshing) return;
    setBalRefreshing(true);
    try {
      const pts = await fetchPoints(username);
      setBalance(pts);
    } catch {}
    setBalRefreshing(false);
  }, [balRefreshing, username]);

  const addHistory = useCallback((symbols, net, type, game = 'slots') => {
    const entry = { id: ++historyId, symbols, net, type, game, timestamp: Date.now() };
    setHistory(prev => [entry, ...prev].slice(0, HISTORY_MAX));
  }, [setHistory]);

  const handleSelectGame = useCallback((game) => {
    setActiveGame(game);
    setTab('game');
  }, []);

  const sharedGameProps = {
    balance, setBalance, username, showToast, addHistory,
  };

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
                        <p className="deposit-info">Subscribe to earn <strong>1,000 pts</strong> instantly!</p>
                        <div className="deposit-links">
                          <a href={`https://www.twitch.tv/subs/${CHANNEL_NAME}`} target="_blank" rel="noopener noreferrer" className="deposit-link deposit-sub">
                            <Heart size={14} /> Subscribe to {CHANNEL_NAME}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="header-balance">
                    <Coins size={14} />
                    <span className="header-balance-amount">{balance.toLocaleString()}</span>
                    <button className="refresh-bal-btn" onClick={refreshBalance} disabled={balRefreshing} title="Refresh points" aria-label="Refresh balance">
                      <RefreshCw size={11} className={balRefreshing ? 'spin-icon' : ''} />
                    </button>
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
                  {/* Game selector + tabs */}
                  <div className="tab-bar">
                    <GameSelector activeGame={activeGame} onSelectGame={handleSelectGame} />
                    <div className="tab-divider" />
                    <button
                      className={`tab-btn ${tab === 'history' ? 'tab-active' : ''}`}
                      onClick={() => setTab('history')}
                    >
                      <History size={14} />
                    </button>
                    <button
                      className={`tab-btn ${tab === 'leaderboard' ? 'tab-active' : ''}`}
                      onClick={() => setTab('leaderboard')}
                    >
                      <Trophy size={14} />
                    </button>
                  </div>

                  <div className="tab-content">
                    {tab === 'game' && (
                      <div className="layout-slots">
                        <GameInfo game={activeGame} />
                        {activeGame === 'slots' && (
                          <SlotMachine
                            {...sharedGameProps}
                            jackpot={jackpot}
                            setJackpot={setJackpot}
                          />
                        )}
                        {activeGame === 'blackjack' && <Blackjack {...sharedGameProps} />}
                        {activeGame === 'roulette' && <Roulette {...sharedGameProps} />}
                        {activeGame === 'mines' && <Mines {...sharedGameProps} />}
                      </div>
                    )}
                    {tab === 'history' && (
                      <div className="tab-page">
                        <SpinHistory history={history} />
                      </div>
                    )}
                    {tab === 'leaderboard' && (
                      <div className="tab-page">
                        <Leaderboard entries={leaderboard} onRefresh={refreshLeaderboard} refreshing={lbRefreshing} />
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
