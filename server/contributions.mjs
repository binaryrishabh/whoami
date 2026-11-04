// Reads a GitHub user's public contribution calendar (the same one shown on their profile).
// Shared by the live endpoint (api/github.js), the dev server, and scripts/github.mjs.
export async function contributions(user) {
  const res = await fetch(`https://github.com/users/${encodeURIComponent(user)}/contributions`, { headers: { 'User-Agent': 'portfolio-contributions' } });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const html = await res.text();
  const cells = [...html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})" id="(contribution-day-component-(\d+)-(\d+))" data-level="(\d)"/g)]
    .map(m => ({ date: m[1], id: m[2], weekday: Number(m[3]), week: Number(m[4]), level: Number(m[5]) }));
  if (!cells.length) throw new Error('No contribution cells found; GitHub may have changed its markup.');
  const tips = new Map([...html.matchAll(/<tool-tip[^>]*for="(contribution-day-component-\d+-\d+)"[^>]*>([^<]*)<\/tool-tip>/g)].map(m => [m[1], m[2]]));
  const days = cells.map(c => {
    const n = /^(\d+) contribution/.exec(tips.get(c.id) || '');
    return { date: c.date, week: c.week, weekday: c.weekday, level: c.level, count: n ? Number(n[1]) : 0 };
  }).sort((a, b) => a.date.localeCompare(b.date));
  return { user, updated: new Date().toISOString(), total: days.reduce((a, d) => a + d.count, 0), days };
}
