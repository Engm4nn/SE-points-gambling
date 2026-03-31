const CLIENT_VERSION = 12;
let checking = false;

export async function checkVersion() {
  if (checking) return;
  checking = true;
  try {
    const res = await fetch('/api/version');
    if (!res.ok) return;
    const { version } = await res.json();
    if (version > CLIENT_VERSION) {
      // Force reload — server has a newer version
      window.location.reload();
    }
  } catch {} finally {
    checking = false;
  }
}

// Check every 30 seconds
export function startVersionPolling() {
  checkVersion();
  setInterval(checkVersion, 30000);
}
