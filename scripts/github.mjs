// Refreshes src/data/github.json from the public GitHub contribution calendar.
// Usage: node scripts/github.mjs [username]
import { writeFile } from 'node:fs/promises';

const user = process.argv[2] || 'binaryrishabh';
const html = await (await fetch(`https://github.com/users/${user}/contributions`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
const cells = [...html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})" id="(contribution-day-component-(\d+)-(\d+))" data-level="(\d)"/g)]
  .map(m => ({ date: m[1], id: m[2], weekday: Number(m[3]), week: Number(m[4]), level: Number(m[5]) }));
const tips = new Map([...html.matchAll(/<tool-tip[^>]*for="(contribution-day-component-\d+-\d+)"[^>]*>([^<]*)<\/tool-tip>/g)].map(m => [m[1], m[2]]));
const days = cells.map(c => {
  const t = tips.get(c.id) || '';
  const n = /^(\d+) contribution/.exec(t);
  return { date: c.date, week: c.week, weekday: c.weekday, level: c.level, count: n ? Number(n[1]) : 0 };
}).sort((a, b) => a.date.localeCompare(b.date));
const total = days.reduce((a, d) => a + d.count, 0);
if (!days.length) { console.error('No contribution cells found; GitHub may have changed its markup.'); process.exit(1); }
await writeFile(new URL('../src/data/github.json', import.meta.url), JSON.stringify({ user, updated: new Date().toISOString().slice(0, 10), total, days }, null, 0));
console.log(`${user}: ${days.length} days, ${total} contributions`);
