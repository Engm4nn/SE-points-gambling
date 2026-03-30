const SE_BASE = 'https://api.streamelements.com/kappa/v2';

export async function fetchPoints(channel, username, jwt) {
  const res = await fetch(`${SE_BASE}/points/${channel}/${username}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) throw new Error(`SE API error: ${res.status}`);
  const data = await res.json();
  return data.points ?? 0;
}

export async function updatePoints(channel, username, amount, jwt) {
  const endpoint = amount >= 0
    ? `${SE_BASE}/points/${channel}/${username}/${Math.abs(amount)}`
    : `${SE_BASE}/points/${channel}/${username}/-${Math.abs(amount)}`;

  const res = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SE API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function deductPoints(channel, username, amount, jwt) {
  return updatePoints(channel, username, -Math.abs(amount), jwt);
}

export async function addPoints(channel, username, amount, jwt) {
  return updatePoints(channel, username, Math.abs(amount), jwt);
}
