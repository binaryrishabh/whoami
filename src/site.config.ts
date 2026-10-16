/**
 * Everything the world says lives here. Each island is generated from one entry: add, remove,
 * reorder or rename islands freely and the world rearranges itself. Island kinds:
 *
 *   'about'      the island you start on: your name in big letters
 *   'experience' one pavilion per role
 *   'project'    one island per project, with its own pavilion and sculpture
 *   'skills'     terraces, one per group of skills
 *   'stats'      towers whose heights follow the numbers
 *   'github'     your contribution calendar, built as a field of stone tiles (data: scripts/github.mjs)
 *   'education'  a small campus
 *   'contact'    a lighthouse
 */

export type Link = { label: string; url: string };
export type Island =
  | { kind: 'about'; title: string }
  | { kind: 'experience'; title: string; roles: { role: string; org: string; period: string; place: string; stack: string; url?: string; points: string[] }[] }
  | { kind: 'project'; title: string; stack: string; links: Link[]; points: string[] }
  | { kind: 'skills'; title: string; groups: { name: string; items: string[] }[] }
  | { kind: 'stats'; title: string; items: { label: string; value: number; display: string; note: string; url: string }[] }
  | { kind: 'github'; title: string; user: string }
  | { kind: 'education'; title: string; school: string; degree: string; period: string; place: string }
  | { kind: 'contact'; title: string };

export const site = {
  name: 'Rishabh Srivastava',
  role: 'Full-stack engineer',
  summary: 'Full-stack engineer (TypeScript, React, Node.js/Bun, PostgreSQL, Redis) who ships production apps and LLM-powered pipelines, and has built door detection that reads CAD floor plans directly from vector PDFs.',
  location: 'India (IST) · open to remote, or onsite anywhere in India',
  email: 'srivastavarishabh2001@gmail.com',
  links: [
    { label: 'GitHub', url: 'https://github.com/binaryrishabh' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/binaryrishabh' },
  ] as Link[],

  islands: [
    { kind: 'about', title: 'Rishabh Srivastava' },
    {
      kind: 'experience', title: 'Experience',
      roles: [{
        role: 'Software Engineer', org: 'lapwork', period: 'Jan 2026 – present', place: 'India (remote)', url: 'https://lapwork.in/',
        stack: 'Electron, React, SQLite, Next.js, PostgreSQL',
        points: [
          'Develop and maintain an offline-first Windows productivity app with Electron, React and SQLite, keeping activity records local for privacy-focused desktop workflows.',
          'Reduced startup time by 65%, from 3.4 s to 1.2 s, through code splitting and lazy loading.',
          'Cut SQLite query latency by 87%, from 150 ms to 20 ms, with prepared statements and data-layer optimisation.',
          'Built automated activity logging through active-window monitoring and application categories that classify productive and distracted time.',
          'Own desktop release workflows and auto-updates, and maintain a Next.js distribution site backed by PostgreSQL and Cloudflare R2.',
        ],
      }],
    },
    {
      kind: 'project', title: 'CAD Floor-Plan Door Detector', stack: 'Python, PyMuPDF, NumPy, Pillow', links: [],
      points: [
        'Built during a work trial with a US construction-tech startup to detect doors directly in CAD-exported vector PDFs, reading PyMuPDF drawing operators and the text layer with no OCR.',
        'Reconstructed door swings exported as 12–14 exploded line segments: chained segments by shared endpoints, fitted circles with least squares, checked quarter-circle spans and validated the door leaf from the fitted hinge, with thresholds normalised to drawing scale.',
        'Classified sheets and reconciled overlapping overall and enlarged sheets so each physical door counts once: 168 sheet-level detections reduced to 95 project-level doors in about 23 s on a full plan set, with uncertain cases sent to a review queue instead of guessed.',
      ],
    },
    {
      kind: 'project', title: 'InfraForge', stack: 'React, TypeScript, Bun, Express, PostgreSQL, Redis, Docker, AWS',
      links: [{ label: 'Live', url: 'https://infraforge.lapwork.in/' }, { label: 'GitHub', url: 'https://github.com/binaryrishabh/InfraForge' }],
      points: [
        'Designed a React/dnd-kit canvas with drag-and-drop editing, Manhattan connection routing and undo/redo for modelling cloud infrastructure.',
        'Architected a 4-service Bun/Express backend with a transactional outbox, BullMQ orchestration for 9-stage pipelines and Zod request validation.',
        'Modelled capacity, cost and failure states for 11 resource types with a deterministic simulation engine using AWS and DigitalOcean SKU data.',
        'Streamed 1 Hz WebSocket snapshots through Redis Pub/Sub and scoped Zustand subscriptions to update only the affected canvas nodes.',
      ],
    },
    {
      kind: 'project', title: 'Allrecipes Tweaks', stack: 'React, TypeScript, Bun, Express, PostgreSQL, Prisma, Gemini API',
      links: [{ label: 'Live', url: 'https://allrecipes.lapwork.in/' }, { label: 'GitHub', url: 'https://github.com/binaryrishabh/PlankRecipe' }],
      points: [
        'Engineered a recipe-analysis pipeline that retrieves up to 50 reviews per recipe, parses JSON-LD and uses parallel Gemini API calls to extract ingredient and instruction changes.',
        'Built LCS-based word-level diffs and original/tweak switching; matched generated edit references to source recipe lines and discarded unmatched changes.',
        'Cached analyses in PostgreSQL via Prisma to skip repeat scraping and Gemini calls, with on-demand refresh and history for the 20 most recent recipes.',
      ],
    },
    {
      kind: 'skills', title: 'Skills',
      groups: [
        { name: 'Languages', items: ['TypeScript', 'JavaScript', 'Python', 'SQL', 'C++', 'Java', 'Rust'] },
        { name: 'Backend', items: ['Node.js', 'Bun', 'Express', 'REST APIs', 'WebSockets', 'BullMQ', 'Zod', 'Prisma', 'Gemini API', 'JWT', 'OAuth', 'NextAuth'] },
        { name: 'Frontend', items: ['React', 'Next.js', 'Electron', 'Tailwind CSS', 'Zustand', 'Vite', 'HTML/CSS'] },
        { name: 'Databases', items: ['PostgreSQL', 'SQLite', 'Redis'] },
        { name: 'Cloud / DevOps', items: ['AWS EC2', 'Docker', 'Linux', 'Nginx', 'Git', 'GitHub Actions', 'CI/CD', 'Vercel', 'Cloudflare R2'] },
        { name: 'PDF / Geometry', items: ['PyMuPDF (vector PDF parsing)', 'NumPy', 'Pillow'] },
        { name: 'Engineering', items: ['Distributed systems', 'Asynchronous processing', 'Caching', 'Performance optimisation'] },
      ],
    },
    {
      kind: 'stats', title: 'Competitive programming',
      items: [
        { label: 'LeetCode', value: 1700, display: '1700+', note: 'rating · 800+ problems solved', url: 'https://leetcode.com/u/binaryrishabh/' },
        { label: 'AtCoder', value: 1400, display: '1400+', note: 'rating', url: 'https://atcoder.jp/users/binaryrishabh' },
        { label: 'Codeforces', value: 500, display: '500+', note: 'problems solved', url: 'https://codeforces.com/profile/Rishabh_codes/' },
      ],
    },
    { kind: 'github', title: 'A year on GitHub', user: 'binaryrishabh' },
    { kind: 'education', title: 'Education', school: 'Kalinga Institute of Industrial Technology (KIIT)', degree: 'Bachelor of Technology in Information Technology', period: 'Oct 2021 – Aug 2025', place: 'Bhubaneswar, India' },
    { kind: 'contact', title: 'Contact' },
  ] as Island[],
};
