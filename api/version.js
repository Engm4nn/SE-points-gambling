// Increment this every deploy to force client refresh
const CURRENT_VERSION = 7;

export default function handler(req, res) {
  res.json({ version: CURRENT_VERSION });
}
