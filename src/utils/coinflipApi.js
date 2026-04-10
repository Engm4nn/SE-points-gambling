import { authHeaders } from './api';

export async function coinflipStart(amount, choice) {
  const res = await fetch('/api/coinflip', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action: 'flip', amount, choice }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(data.error || 'Flip failed');
  }
  return res.json();
}

export async function coinflipDouble(betId) {
  const res = await fetch('/api/coinflip', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action: 'double', betId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(data.error || 'Double failed');
  }
  return res.json();
}

export async function coinflipCashout(betId) {
  const res = await fetch('/api/coinflip', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action: 'cashout', betId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(data.error || 'Cashout failed');
  }
  return res.json();
}
