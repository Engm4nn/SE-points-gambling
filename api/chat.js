import { requireAuth } from './session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const session = await requireAuth(req);
    if (!session) return res.status(401).json({ error: 'Not authenticated' });

    const { message } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing message' });
    }

    const jwt = process.env.SE_JWT;
    const channelName = process.env.CHANNEL_NAME;
    if (!jwt || !channelName) return res.status(500).json({ error: 'Server misconfigured' });

    const SE_BASE = 'https://api.streamelements.com/kappa/v2';
    let channelId;
    const chRes = await fetch(`${SE_BASE}/channels/${channelName}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!chRes.ok) return res.status(chRes.status).json({ error: 'Channel not found' });
    const chData = await chRes.json();
    channelId = chData._id;

    const response = await fetch(`${SE_BASE}/bot/${channelId}/say`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: message.slice(0, 500) }),
    });
    if (!response.ok) return res.status(response.status).json({ error: 'SE API error' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to send chat message' });
  }
}
