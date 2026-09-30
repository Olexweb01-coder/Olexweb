# Olexweb

The Olexweb studio: a 360° room as the home page, with real pages underneath for search.

## Run locally (PowerShell)

```powershell
npm install
npm run dev
```
Open http://localhost:3000

## Build and deploy

```powershell
npm run build
npm start
```
Push to GitHub and import the repo in Vercel; no extra configuration is needed.

## Where things live

- `content/site.js` — every word on the site. Edit here. Lines marked `[draft]` are placeholders to replace.
- `public/studio/pano.jpg` — the room. Replace with a higher-resolution render of the same room (same framing) and nothing else changes.
- `public/studio/sites/*.jpg` — the tours that play on the monitors.
- `public/studio/photos/` — Olaitan's photographs. `me_*.jpg` are the ones that appear in the frame in the room.
- `lib/engine.js` — the room engine (three.js). Object positions are pixel coordinates on the 1536×1024 reference of the panorama.
- `components/Studio.jsx` — mounts the engine on the home page.
- `app/*` — the pages: /olexweb, /work, /work/[slug], /olaitan, /ventures, /ventures/[slug], /lab, /thinking, /teaching, /vision, /insights, /insights/[slug], /contact.

## Live websites on the monitor

A site plays live on the monitor only if its own server allows framing. `embed: true` in `content/site.js` marks the ones that do. To allow one of your other sites, add on that site:
`Content-Security-Policy: frame-ancestors 'self' https://olexweb.com https://*.olexweb.com https://*.vercel.app` and remove any `X-Frame-Options` header, then set `embed: true`.

## Music

The room plays `public/studio/music.mp3` on a loop after the visitor's first click, with its own on/off button beside the speaker and the same volume slider. Put your track there (it must be one you have the rights to use on a public website), or set `music: null` in `content/site.js` for no music. If the file is missing the music button simply hides itself.
