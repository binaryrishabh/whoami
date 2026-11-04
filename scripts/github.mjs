// Refreshes src/data/github.json, the fallback the page shows if the live calendar can't be fetched.
// Usage: node scripts/github.mjs [username]
import { writeFile } from 'node:fs/promises';
import { contributions } from '../server/contributions.mjs';

const data = await contributions(process.argv[2] || 'binaryrishabh');
await writeFile(new URL('../src/data/github.json', import.meta.url), JSON.stringify({ ...data, updated: data.updated.slice(0, 10) }, null, 0));
console.log(`${data.user}: ${data.days.length} days, ${data.total} contributions`);
