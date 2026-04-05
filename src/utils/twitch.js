const DEFAULT_TWITCH_CLIENT_ID = 'rfht3kdwifzsiw4baj1j7fairifr6f';

const TWITCH_CLIENT_ID =
  import.meta.env.VITE_TWITCH_CLIENT_ID || DEFAULT_TWITCH_CLIENT_ID;

function getRedirectUri() {
  return (
    import.meta.env.VITE_TWITCH_REDIRECT_URI ||
    `${window.location.origin}/auth/callback`
  );
}

export function getTwitchLoginUrl() {
  const params = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: 'token',
    scope: '',
  });
  return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
}

// Parse access token from URL hash after Twitch redirect
export function parseAuthCallback() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get('access_token');
}

// Validate token and get username from Twitch
export async function getTwitchUser(accessToken) {
  const res = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': TWITCH_CLIENT_ID,
    },
  });
  if (!res.ok) throw new Error('Failed to validate Twitch token');
  const data = await res.json();
  if (!data.data?.[0]) throw new Error('No user data');
  return {
    id: data.data[0].id,
    login: data.data[0].login,
    displayName: data.data[0].display_name,
    profileImage: data.data[0].profile_image_url,
  };
}
