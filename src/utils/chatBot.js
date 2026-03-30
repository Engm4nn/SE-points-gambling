const SE_BASE = 'https://api.streamelements.com/kappa/v2';

// Send a message to SE chat bot
export async function sendChatMessage(channel, jwt, message) {
  try {
    const res = await fetch(`${SE_BASE}/bot/${channel}/say`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error(`Chat API error: ${res.status}`);
    return true;
  } catch (err) {
    console.warn('Failed to send chat message:', err);
    return false;
  }
}

// Format a big win chat message
export function formatWinMessage(username, amount, multiplier, type, siteUrl) {
  const emojis = type === 'jackpot' ? '🏆🏆🏆' : type === 'mega' ? '💎💎💎' : '🎰🎰🎰';

  let msg = `${emojis} ${username} just won ${amount.toLocaleString()} points`;

  if (type === 'jackpot') {
    msg += ' hitting the JACKPOT!';
  } else if (multiplier) {
    msg += ` (${multiplier}× multiplier)!`;
  }

  if (siteUrl) {
    msg += ` | Play: ${siteUrl}`;
  }

  return msg;
}

// Determine if a win is "big" enough to announce
export function shouldAnnounce(winAmount, bet, type) {
  if (type === 'jackpot') return true;
  if (type === 'bonus') return true;
  // Announce 10x+ wins
  if (bet > 0 && winAmount / bet >= 10) return true;
  // Announce wins over 5000
  if (winAmount >= 5000) return true;
  return false;
}
