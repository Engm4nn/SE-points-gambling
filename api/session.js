import { getDb, ensureTables } from './db.js';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const TWITCH_CLIENT_ID = process.env.VITE_TWITCH_CLIENT_ID || 'rfht3kdwifzsiw4baj1j7fairifr6f';

export async function ensureSessionTable() {
  const db = getDb();
  await db`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      twitch_user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_sessions_username ON sessions (username)`;
}

export async function createSession(username, twitchUserId) {
  await ensureTables();
  await ensureSessionTable();
  const db = getDb();
  const token = crypto.randomUUID();
  await db`
    INSERT INTO sessions (token, username, twitch_user_id)
    VALUES (${token}, ${username}, ${twitchUserId})
  `;
  return token;
}

export async function validateSession(token) {
  if (!token || typeof token !== 'string') return null;
  await ensureTables();
  await ensureSessionTable();
  const db = getDb();
  const rows = await db`
    SELECT username, twitch_user_id, created_at, last_seen
    FROM sessions WHERE token = ${token}
  `;
  if (rows.length === 0) return null;
  const session = rows[0];
  if (Date.now() - new Date(session.created_at).getTime() > SESSION_TTL_MS) {
    await db`DELETE FROM sessions WHERE token = ${token}`;
    return null;
  }
  await db`UPDATE sessions SET last_seen = NOW() WHERE token = ${token}`;
  return { username: session.username, twitchUserId: session.twitch_user_id };
}

export async function destroySession(token) {
  if (!token) return;
  const db = getDb();
  await db`DELETE FROM sessions WHERE token = ${token}`;
}

export async function requireAuth(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return null;
  return validateSession(token);
}

export async function validateTwitchToken(accessToken) {
  const res = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': TWITCH_CLIENT_ID,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.data?.[0]) return null;
  return {
    id: data.data[0].id,
    login: data.data[0].login,
    displayName: data.data[0].display_name,
    profileImage: data.data[0].profile_image_url,
  };
}
