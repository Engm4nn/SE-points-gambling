# StreamSlots

## Required env vars

Client-side:

- `VITE_CHANNEL_NAME`
- `VITE_TWITCH_CLIENT_ID`
- `VITE_TWITCH_REDIRECT_URI` (optional, defaults to `${window.location.origin}/auth/callback`)

Server-side:

- `CHANNEL_NAME`
- `SE_JWT`

## Twitch OAuth setup

When cloning this app for another streamer, make sure the Twitch application tied to `VITE_TWITCH_CLIENT_ID` has the exact callback URL registered in the Twitch developer console.

Example production callback:

`https://badvf-secasino.vercel.app/auth/callback`

Example local callback:

`http://localhost:5173/auth/callback`

If Twitch says `redirect_mismatch`, the redirect URL being sent by the app does not exactly match one of the URLs registered for that Twitch app.

## Vercel setup

Set these environment variables in Vercel for the target project:

```bash
VITE_CHANNEL_NAME=badvf
VITE_TWITCH_CLIENT_ID=your_twitch_app_client_id
VITE_TWITCH_REDIRECT_URI=https://badvf-secasino.vercel.app/auth/callback
CHANNEL_NAME=badvf
SE_JWT=your_streamelements_jwt_token_here
```
