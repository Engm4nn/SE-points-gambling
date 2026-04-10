import { authHeaders } from './api';

export async function sendChatMessage(message) {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function formatWinMessage(username, amount, multiplier, type, siteUrl) {
  const emojis = type === 'jackpot' ? '🏆🏆🏆' : type === 'mega' ? '💎💎💎' : '🎰🎰🎰';

  let msg = `${emojis} ${username} just won ${amount.toLocaleString()} points`;

  if (type === 'jackpot') {
    msg += ' hitting the JACKPOT!';
  } else if (multiplier) {
    msg += ` (${Math.floor(multiplier)}x)!`;
  }

  if (siteUrl) {
    msg += ` | Play: ${siteUrl}`;
  }

  return msg;
}

export function shouldAnnounce(winAmount, bet, type) {
  if (type === 'jackpot') return true;
  const multiplier = bet > 0 ? winAmount / bet : 0;
  if (bet >= 1000) return multiplier >= 10;
  if (bet >= 500) return multiplier >= 25;
  return false;
}
