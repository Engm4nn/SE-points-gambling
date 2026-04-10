import { authHeaders } from './api';

export async function fetchJackpot() {
  try {
    const res = await fetch('/api/jackpot');
    if (!res.ok) return 5000;
    const data = await res.json();
    return data.jackpot ?? 5000;
  } catch {
    return 5000;
  }
}

export async function contributeToJackpot(amount) {
  try {
    const res = await fetch('/api/jackpot', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action: 'contribute', amount }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.jackpot;
  } catch {
    return null;
  }
}

export async function winJackpot() {
  try {
    const res = await fetch('/api/jackpot', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action: 'win' }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
