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

Each island can also take a `tagline`: the italic line under its name when you arrive (each kind has a sensible default). Two more settings live at the top of the file: `tagline`, the line under your name on the title screen, and `loadingLines`, the sentences shown one at a time while the world loads.

Several islands of the same kind are fine (that is how the three projects work). Bigger islands (`about`, `experience`, `skills`, `github`) also get a spring and a waterfall.

### GitHub data

The dial reads `src/data/github.json`. Refresh it from your public contribution calendar with:

```bash
bun run github
```

(The username is set in `scripts/github.mjs`.)

## The screens

- **Loading:** stills of the world itself (`public/loading/art-01…06.webp`) crossfade and slowly push in, while a rope pays out with the real download progress. It is plain HTML in `index.html`, so it paints before any script runs; `src/ui/Loader.tsx` takes over and hands off to the live opening shot.
- **Title:** the name, role and tagline over the world, once the opening shot lands. Any key or a click takes off.
- **Arrival:** each island's number, name and tagline, large, for a few seconds as the camera settles.
- **Map (M):** the whole ring from above, with an index of every island.
- **In flight:** a compass strip with every island at its bearing.
- **Too small a window** (under 960 × 560, phones included): the world pauses behind a page that says so and still gives the email and links.

To refresh the loading stills after changing the world, render new frames at 1920 × 1080 with the dev hooks (`__dockView(i, yaw, pitch, zoom)` pins the camera on an island, with the interface hidden) and save them over `public/loading/art-*.webp`. The link-preview card is `public/og.jpg`.

## Deploying

Import the repository on Vercel with the Vite preset and default settings; every push to `main` deploys. The build fills in the site's address for link previews from `VERCEL_PROJECT_PRODUCTION_URL` (or `SITE_URL`, if you set one).

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
