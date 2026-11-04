// GET /api/github?user=… → the live contribution calendar. Vercel's edge cache keeps a copy for an hour,
// and serves the old one for up to a day while it fetches a new one, so GitHub is asked at most once an hour.
import { contributions } from '../server/contributions.mjs';

const ALLOWED = new Set(['binaryrishabh']);

export default async function handler(req, res) {
  const user = String(req.query?.user || 'binaryrishabh').toLowerCase();
  if (!ALLOWED.has(user)) { res.status(400).json({ error: 'unknown user' }); return; }
  try {
    const data = await contributions(user);
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: String(e.message || e) });
  }
}
