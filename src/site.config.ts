/**
 * Everything the portfolio says lives here: the page at / and the 3D world at /world/ both read it.
 *
 * The world: each island is generated from one entry. Each island is generated from one entry: add, remove,
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
/** every island may also carry a `tagline`: the italic line under its name when you arrive */
export type Island = { tagline?: string } & (
  | { kind: 'about'; title: string }
  | { kind: 'experience'; title: string; roles: { role: string; org: string; period: string; place: string; stack: string; url?: string; points: string[] }[] }
  /** `visual` picks the moving illustration on the portfolio page: 'blueprint', 'canvas' or 'diff'; anything else
   *  (or nothing) shows a little group of toys, chosen with `toys` (names of the files in public/toys) */
  | { kind: 'project'; title: string; stack: string; links: Link[]; points: string[]; visual?: 'blueprint' | 'canvas' | 'diff'; toys?: string[];
      /** order on the portfolio page (lower first); the world keeps the order of this list */ rank?: number }
  | { kind: 'skills'; title: string; groups: { name: string; items: string[]; toy?: string }[] }
  | { kind: 'stats'; title: string; items: { label: string; value: number; towerWeight?: number; display: string; note: string; url: string }[] }
  | { kind: 'github'; title: string; user: string }
  | { kind: 'education'; title: string; school: string; degree: string; period?: string; place: string }
  | { kind: 'contact'; title: string }
);

export const site = {
  name: 'Rishabh Srivastava',
  role: 'Full-stack engineer',
  summary: 'Full-stack engineer (TypeScript, React, Node.js/Bun, PostgreSQL, Redis) who ships production apps and LLM-powered pipelines, and has built door detection that reads CAD floor plans directly from vector PDFs.',
  location: 'India (IST) · open to remote, or onsite anywhere in India',
  /** the italic line under the name on the title screen */
  tagline: 'A small world of floating islands, one for each part of my work',
  /** shown one at a time on the loading screen */
  loadingLines: [
    'Every island is one part of my work. The rope bridges show the way round.',
    'Click any island’s name and the drone flies you there.',
    'Press M at any time to see the whole world from above.',
    'The stone dial is a real year of my GitHub: a spoke for every week, a stone for every day.',
    'The towers grow with my competitive programming numbers.',
    'Fly close to a waterfall and you will hear it.',
    'The quickest way to reach me is email. You will find it at the lighthouse.',
  ],
  /** the portfolio page. Wrap words in *stars* to colour them; ' / ' starts a new line. */
  page: {
    headline: 'I make slow / software *fast.*',
    intro: 'Backends, LLM pipelines and the apps on top of them. TypeScript, Bun, PostgreSQL, Redis. I measure first, then I fix it.',
    /** the before → after cards beside the headline */
    proofs: [
      { label: 'App start-up', from: '3.4 s', to: '1.2 s', toy: 'terminal' },
      { label: 'SQLite query', from: '150 ms', to: '20 ms', toy: 'database' },
      { label: 'Doors, counted once', from: '168', to: '95', toy: 'chip' },
    ],
    about: [
      'I’m a software engineer at lapwork, working on an offline-first Windows app built with Electron, React and SQLite.',
      'I like the unglamorous parts: the cold start, the query plan, the queue that must not drop a message. I measure before I change anything, and I keep the numbers.',
    ],
    /** the closing line */
    contact: 'Got something *slow?*',
  },
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
      kind: 'project', title: 'CAD Floor-Plan Door Detector', stack: 'Python, PyMuPDF, NumPy, Pillow', links: [], visual: 'blueprint', rank: 2,
      points: [
        'Built during a work trial with a US construction-tech startup to detect doors directly in CAD-exported vector PDFs, reading PyMuPDF drawing operators and the text layer with no OCR.',
        'Reconstructed door swings exported as 12–14 exploded line segments: chained segments by shared endpoints, fitted circles with least squares, checked quarter-circle spans and validated the door leaf from the fitted hinge, with thresholds normalised to drawing scale.',
        'Classified sheets and reconciled overlapping overall and enlarged sheets so each physical door counts once: 168 sheet-level detections reduced to 95 project-level doors in about 23 s on a full plan set, with uncertain cases sent to a review queue instead of guessed.',
      ],
    },
    {
      kind: 'project', title: 'InfraForge', stack: 'React, TypeScript, Bun, Express, PostgreSQL, Redis, Docker, AWS', visual: 'canvas', rank: 1,
      links: [{ label: 'Live', url: 'https://infraforge.lapwork.in/' }, { label: 'GitHub', url: 'https://github.com/binaryrishabh/InfraForge' }],
      points: [
        'Designed a React/dnd-kit canvas with drag-and-drop editing, Manhattan connection routing and undo/redo for modelling cloud infrastructure.',
        'Architected a 4-service Bun/Express backend with a transactional outbox, BullMQ orchestration for 9-stage pipelines and Zod request validation.',
        'Modelled capacity, cost and failure states for 11 resource types with a deterministic simulation engine using AWS and DigitalOcean SKU data.',
        'Streamed 1 Hz WebSocket snapshots through Redis Pub/Sub and scoped Zustand subscriptions to update only the affected canvas nodes.',
      ],
    },
    {
      kind: 'project', title: 'Allrecipes Tweaks', stack: 'React, TypeScript, Bun, Express, PostgreSQL, Prisma, Gemini API', visual: 'diff', rank: 3,
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
        { name: 'Languages', toy: 'terminal', items: ['TypeScript', 'JavaScript', 'Python', 'SQL', 'C++', 'Java', 'Rust'] },
        { name: 'Backend', toy: 'server', items: ['Node.js', 'Bun', 'Express', 'REST APIs', 'WebSockets', 'BullMQ', 'Zod', 'Prisma', 'Gemini API', 'JWT', 'OAuth', 'NextAuth'] },
        { name: 'Frontend', toy: 'phone', items: ['React', 'Next.js', 'Electron', 'Tailwind CSS', 'Zustand', 'Vite', 'HTML/CSS'] },
        { name: 'Databases', toy: 'database', items: ['PostgreSQL', 'SQLite', 'Redis'] },
        { name: 'Cloud / DevOps', toy: 'cloud', items: ['AWS EC2', 'Docker', 'Linux', 'Nginx', 'Git', 'GitHub Actions', 'CI/CD', 'Vercel', 'Cloudflare R2'] },
        { name: 'PDF / Geometry', toy: 'chip', items: ['PyMuPDF (vector PDF parsing)', 'NumPy', 'Pillow'] },
        { name: 'Engineering', toy: 'gear', items: ['Distributed systems', 'Asynchronous processing', 'Caching', 'Performance optimisation'] },
      ],
    },
    {
      kind: 'stats', title: 'Competitive programming',
      // Keep the existing tower proportions independent of the updated statistics.
      items: [
        { label: 'LeetCode', value: 1655, towerWeight: 1700, display: '1655+', note: 'rating · 785 problems solved', url: 'https://leetcode.com/u/binaryrishabh/' },
        { label: 'AtCoder', value: 1239, towerWeight: 1400, display: '1239+', note: 'rating', url: 'https://atcoder.jp/users/binaryrishabh' },
        { label: 'Codeforces', value: 400, towerWeight: 500, display: '400+', note: 'problems solved', url: 'https://codeforces.com/profile/Rishabh_codes/' },
      ],
    },
    { kind: 'github', title: 'A year on GitHub', user: 'binaryrishabh' },
    { kind: 'education', title: 'Education', school: 'Kalinga Institute of Industrial Technology (KIIT)', degree: 'Bachelor of Technology in Information Technology', place: 'Bhubaneswar, India' },
    { kind: 'contact', title: 'Contact' },
  ] as Island[],
};
