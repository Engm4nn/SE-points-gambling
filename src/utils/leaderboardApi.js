export async function reportSpin(username, wagered, won) {
  try {
    await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, wagered, won }),
    });
  } catch {}
}

export async function fetchLeaderboard(type = 'top3', limit = 3) {
  const params = new URLSearchParams({ type, limit: String(limit) });
  const res = await fetch(`/api/leaderboard?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.leaderboard || [];
}
