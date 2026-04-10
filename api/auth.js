import { createSession, validateTwitchToken } from './session.js';
import { sanitize } from './se.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { twitchToken } = req.body || {};
    if (!twitchToken) return res.status(400).json({ error: 'Missing Twitch token' });

    const twitchUser = await validateTwitchToken(twitchToken);
    if (!twitchUser) return res.status(401).json({ error: 'Invalid Twitch token' });

    const username = sanitize(twitchUser.login);

    const sessionToken = await createSession(username, twitchUser.id);

    return res.json({
      token: sessionToken,
      username,
      displayName: twitchUser.displayName,
      profileImage: twitchUser.profileImage,
    });
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
