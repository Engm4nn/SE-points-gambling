import { useState, useCallback, useMemo } from 'react';
import { Settings, Link, User, Disc3 } from 'lucide-react';
import SetupPanel from './components/SetupPanel';
import UserLogin from './components/UserLogin';
import SlotMachine from './components/SlotMachine';
import TwitchEmbed from './components/TwitchEmbed';
import Leaderboard from './components/Leaderboard';
import SpinHistory from './components/SpinHistory';
import { ToastContainer, createToast } from './components/Toast';
import { useLocalStorage } from './hooks/useLocalStorage';
import { LS_KEYS, LEADERBOARD_MAX, HISTORY_MAX, JACKPOT_SEED } from './utils/constants';
import './styles/app.css';

let historyId = 0;
let lbId = 0;

// Read channel + JWT from URL params (viewer link) or localStorage (streamer)
function getConfig() {
  const params = new URLSearchParams(window.location.search);
  const urlChannel = params.get('channel') || '';
  const urlJwt = params.get('token') || '';
  return { urlChannel, urlJwt };
}

export default function App() {
  const { urlChannel, urlJwt } = useMemo(getConfig, []);

  // localStorage for streamer setup (fallback if no URL params)
  const [storedChannel, setStoredChannel] = useLocalStorage(LS_KEYS.CHANNEL, '');
  const [storedJwt, setStoredJwt] = useLocalStorage(LS_KEYS.JWT, '');

  // URL params take priority over localStorage
  const channel = urlChannel || storedChannel;
  const jwt = urlJwt || storedJwt;
  const isViewer = !!(urlChannel && urlJwt); // came via shared link

  const [username, setUsername] = useLocalStorage(LS_KEYS.USERNAME, '');
  const [balance, setBalance] = useState(0);
  const [loggedIn, setLoggedIn] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const [leaderboard, setLeaderboard] = useLocalStorage(LS_KEYS.LEADERBOARD, []);
  const [history, setHistory] = useLocalStorage(LS_KEYS.HISTORY, []);
  const [jackpot, setJackpot] = useLocalStorage(LS_KEYS.JACKPOT, JACKPOT_SEED);
  const [toasts, setToasts] = useState([]);

  const isSetup = channel && jwt;

  const handleSetupSave = useCallback((ch, token) => {
    setStoredChannel(ch);
    setStoredJwt(token);
    setShowSetup(false);
  }, [setStoredChannel, setStoredJwt]);

  // Generate the shareable viewer link
  const viewerLink = useMemo(() => {
    if (!channel || !jwt) return '';
    const base = window.location.origin + window.location.pathname;
    const params = new URLSearchParams({ channel, token: jwt });
    return `${base}?${params.toString()}`;
  }, [channel, jwt]);

  const copyViewerLink = useCallback(() => {
    if (viewerLink) {
      navigator.clipboard.writeText(viewerLink).then(() => {
        showToast('Viewer link copied!', 'info');
      });
    }
  }, [viewerLink, showToast]);

  const handleLogin = useCallback((user, points) => {
    setUsername(user);
    setBalance(points);
    setLoggedIn(true);
  }, [setUsername]);

  const showToast = useCallback((message, type) => {
    const toast = createToast(message, type);
    setToasts(prev => [...prev.slice(-4), toast]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

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

  // Show setup if not configured and no URL params
  if (!isSetup || showSetup) {
    return (
      <div className="app">
        <SetupPanel channel={storedChannel} jwt={storedJwt} onSave={handleSetupSave} />
      </div>
    );
  }

  // Show login — viewer just enters username
  if (!loggedIn) {
    return (
      <div className="app">
        <div className="app-header">
          <h1 className="app-title"><Disc3 size={22} /> StreamSlots</h1>
          {!isViewer && (
            <button className="settings-btn" onClick={() => setShowSetup(true)} aria-label="Settings">
              <Settings size={18} />
            </button>
          )}
        </div>
        <UserLogin channel={channel} jwt={jwt} onLogin={handleLogin} />
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
          {/* Streamer-only: copy viewer link + settings */}
          {!isViewer && viewerLink && (
            <button className="copy-link-btn" onClick={copyViewerLink} title="Copy viewer link" aria-label="Copy viewer link">
              <Link size={16} /> Share
            </button>
          )}
          {!isViewer && (
            <button className="settings-btn" onClick={() => setShowSetup(true)} aria-label="Settings">
              <Settings size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="app-layout">
        {/* Top: Twitch stream */}
        <div className="layout-stream">
          <TwitchEmbed channel={channel} />
        </div>

        {/* Bottom: Slots + Sidebar */}
        <div className="layout-bottom">
          <div className="layout-slots">
            <SlotMachine
              balance={balance}
              setBalance={setBalance}
              channel={channel}
              username={username}
              jwt={jwt}
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
              isStreamer={!isViewer}
            />
            <SpinHistory history={history} />
          </div>
        </div>
      </div>
    </div>
  );
}
