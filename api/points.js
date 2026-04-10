import { requireAuth } from './session.js';
import { getChannelId, seGetPoints } from './se.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const session = await requireAuth(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    const { channelId, jwt } = await getChannelId();
    const points = await seGetPoints(channelId, jwt, session.username);

    return res.json({ points, username: session.username });
  } catch (err) {
    console.error('Points error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
