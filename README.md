# Portfolio · floating islands

A small world of floating islands above a sea of cloud, one island per part of the portfolio, explored with a camera drone. Built with React Three Fiber.

## Run it

```bash
bun install
bun run dev        # http://localhost:5510
bun run build      # type-checks, then builds to dist/
bun run preview    # serves dist/ on http://localhost:5520
```

`dist/` is a static site: upload it to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages).

## Change what it says

Everything the world says lives in **`src/site.config.ts`**: your name, role, summary, email, links, and the list of islands. Each entry in `islands` becomes one island, in ring order. Add, remove, reorder or rename entries and the world rearranges itself: the ring resizes, bridges reconnect, paths and trees are replanned.

| kind | what is built on the island | what the card shows |
|---|---|---|
| `about` | your first name in cast letters, surname in brass, a landing pad | name, role, summary, links |
| `experience` | a house, with the first organisation's name on its podium | each role: title, org, dates, stack, points |
| `project` | one of three houses (they take turns) and a steel sculpture | title, stack, points, links |
| `skills` | a stone garden: one standing stone per skill, grouped | the groups and skills |
| `stats` | towers whose heights follow the numbers | each number, label, note, link |
| `github` | a stone dial of the last year: a spoke per week, a stone per day | totals and busiest day |
| `education` | a small campus with a clock tower | school, degree, dates, place |
| `contact` | a lighthouse | email and links |

Several islands of the same kind are fine (that is how the three projects work). Bigger islands (`about`, `experience`, `skills`, `github`) also get a spring and a waterfall.

### GitHub data

The dial reads `src/data/github.json`. Refresh it from your public contribution calendar with:

```bash
bun run github
```

(The username is set in `scripts/github.mjs`.)

## Controls

- **Keyboard:** W/S or ↑/↓ fly, A/D or ←/→ turn, Space rise, Shift sink, M for the map.
- **Mouse:** click an island's name to fly there; drag to look around; scroll to zoom.
- **Touch:** a stick to fly and turn, arrows to rise and sink; tap a name to fly there.
- Each card has previous and next links, so every section can be reached without flying at all.

## How it is made

- `src/world/island.ts` builds each island: a domed meadow and a hanging mass of layered rock.
- `src/world/layout.ts` places the ring; `src/world/plan.ts` plans each island's paths, stream and planting.
- `src/world/Structures.tsx` holds the architecture, `Forest.tsx` the trees, `Features.tsx` paths, lamps, water, islets and bridges.
- `src/world/CloudSea.tsx` is the cloud sea; `CameraRig.tsx` the opening shot, chase, arrival framing and map.
- `src/world/MiniatureBlur.ts` gives the tilt-shift look; ambient occlusion switches off by itself on slower GPUs.
- `src/audio.ts` plays the sound once the visitor first touches the page; the mute choice is remembered.

## Credits

Every texture, sky and sound is CC0 and listed in `public/audio/credits.json`:
- **Poly Haven:** cliff rock, grass, board-marked concrete, cedar planks and the sky.
- **ambientCG:** leaf atlases.
- **Freesound:** recordings by Garuda1982 (meadow wind), Sadiquecat (DJI Mavic Mini hover), VKProduktion (waterfall) and ani_music (pencil tap).
