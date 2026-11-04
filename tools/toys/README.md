# The toy factory

Every little object on the portfolio page (servers, the database, the cache bolt…) is made here, from code:
each toy is a signed distance field built from rounded shapes joined smoothly (`sdf.js`), meshed with surface
nets, baked with ambient occlusion and a soft shadow, lit like a vinyl toy and rendered with a transparent
background.

To make or change a toy:

1. Add or edit an entry in `TOYS` in `sdf.js` (shapes, colours, pose).
2. Run the studio: `node tools/toys/serve.mjs`
3. In another terminal: `N=200 node tools/toys/render.mjs server,cache` (or no names for all). PNGs land in `tools/toys/out/`.
   It needs Chrome installed and `playwright-core` (`npm i -D playwright-core`).
4. Trim and convert them to WebP (about 420 px on the long side) into `public/toys/<name>.webp`.
