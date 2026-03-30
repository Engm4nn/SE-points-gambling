const SE_BASE = 'https://api.streamelements.com/kappa/v2';

let cachedChannelId = null;

// Resolve channel name to SE channel ID
export async function getChannelId(channelName, jwt) {
  if (cachedChannelId) return cachedChannelId;

  const res = await fetch(`${SE_BASE}/channels/${channelName}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) throw new Error(`Could not find SE channel: ${res.status}`);
  const data = await res.json();
  cachedChannelId = data._id;
  return cachedChannelId;
}

export async function fetchPoints(channelId, username, jwt) {
  const res = await fetch(`${SE_BASE}/points/${channelId}/${username}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) throw new Error(`SE API error: ${res.status}`);
  const data = await res.json();
  return data.points ?? 0;
}

export async function updatePoints(channelId, username, amount, jwt) {
  const endpoint = amount >= 0
    ? `${SE_BASE}/points/${channelId}/${username}/${Math.abs(amount)}`
    : `${SE_BASE}/points/${channelId}/${username}/-${Math.abs(amount)}`;

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

export async function deductPoints(channelId, username, amount, jwt) {
  return updatePoints(channelId, username, -Math.abs(amount), jwt);
}

export async function addPoints(channelId, username, amount, jwt) {
  return updatePoints(channelId, username, Math.abs(amount), jwt);
}
