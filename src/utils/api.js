const SESSION_KEY = 'se_session_token';

function getSessionToken() {
  return sessionStorage.getItem(SESSION_KEY);
}

function setSessionToken(token) {
  sessionStorage.setItem(SESSION_KEY, token);
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function authHeaders() {
  const token = getSessionToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function authenticate(twitchToken) {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ twitchToken }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Auth failed' }));
    throw new Error(data.error || 'Authentication failed');
  }
  const data = await res.json();
  setSessionToken(data.token);
  return data;
}

export async function fetchPoints() {
  const res = await fetch('/api/points', {
    headers: authHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('SESSION_EXPIRED');
    throw new Error('Could not fetch points');
  }
  const data = await res.json();
  return data.points ?? 0;
}

export async function placeBet(game, amount) {
  const res = await fetch('/api/bet', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action: 'place', game, amount }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Bet failed' }));
    if (res.status === 401) throw new Error('SESSION_EXPIRED');
    throw new Error(data.error || 'Failed to place bet');
  }
  return res.json();
}

export async function deductBet(game, amount) {
  const res = await fetch('/api/bet', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action: 'deduct', game, amount }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Deduct failed' }));
    if (res.status === 401) throw new Error('SESSION_EXPIRED');
    throw new Error(data.error || 'Failed to deduct points');
  }
  return res.json();
}

export async function settleBet(betId, payout) {
  const res = await fetch('/api/bet', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action: 'settle', betId, payout }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Settle failed' }));
    if (res.status === 401) throw new Error('SESSION_EXPIRED');
    throw new Error(data.error || 'Failed to settle bet');
  }
  return res.json();
}

export async function addPoints(username, amount, game = 'unknown', betId) {
  if (!betId) throw new Error('Bet ID required for payout');
  const res = await fetch('/api/payout', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ username, amount: Math.abs(amount), game, betId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Payout failed' }));
    if (res.status === 401) throw new Error('SESSION_EXPIRED');
    throw new Error(data.error || 'Failed to add points');
  }
  return res.json();
}

export async function getChannelId() {
  const res = await fetch('/api/channel');
  if (!res.ok) throw new Error('Could not connect to StreamElements');
  const data = await res.json();
  return data.channelId;
}
