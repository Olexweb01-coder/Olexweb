# OLEXWEB — Handoff document

Paste this whole file into a new chat, together with these uploads, and say "continue from the handoff":

- `olexweb-site.zip` — the complete Next.js project (latest, verified build)
- `olexweb-panorama-1536.jpg` — the room panorama the whole site is measured against
- `olexweb-studio-360.html` — the single-file preview of the room (published artifact)
- your robot frames, logo (transparent PNG), the 7 photos of Olaitan, and the anthem MP3 if you want them changed

Rules for the assistant (state them again in the new chat):
1. Every piece of code must be read back, built and tested before it is handed over. No breakage. My machine is Windows, PowerShell inside VS Code.
2. Show me a preview here before I download. Publish the single-file preview to an artifact; the Next.js project is delivered as a zip.
3. Be honest about limits (sandbox cannot frame external sites, uses a software renderer, has no GPU).

---

## 1. What Olexweb is

**Olexweb is the workspace. Olaitan Adebayo is the human.** The site is a 360° photographic studio (a real generated room) that is the home page; every object in it opens something. Under the room are real pages for search.

- Olexweb speaks from: the desk (monitors, laptop), the window (vision & mission), the TV (teaching), the phone (contact), the stereo (the anthem).
- Olaitan speaks from: the portrait frame (photographs, story), the project wall (ventures: Elvanex Digital, Needar, Aviirel), the notebook (the lab), the bookshelf (insights / thinking).
- Websites belong to Olexweb; companies and products belong to Olaitan. Do not mention Lagos as a base.
- Domain: olexweb.com. Name variants for SEO: Olaitan Adebayo, Adebayo Olaitan, Olex.
- The guide/robot is called **Olex's AI**.

Priority order, always: conversion and usability → content/SEO/accessibility → motion → 3D.

## 2. Contact (wired into the phone and the pages)

- WhatsApp: 07011726321 → `https://wa.me/2347011726321?text=Hi%20Olexweb...` (prefilled)
- Email: info@olexweb.com
- Call: 0701 172 6321; other line: 0803 784 3784
- No booking link yet.

## 3. The room engine (how it works, so nothing is re-invented)

- The panorama `public/studio/pano.jpg` (upscaled to 4096 wide with LapSRN from the 1536×1024 original) is mapped on a sphere. Horizontal mapping is NON-linear because the generator compresses the sides: `yaw = π·x·(A + (1−A)·x²)`, A ≈ 0.667, vertical coverage 160°. All object positions are pixel coordinates on the 1536×1024 original.
- Objects are AREAS (rects in pixel space), hover shows the name beside the cursor (no outline), click anywhere on the object opens it. Dots are small hints only.
- Screens are SURFACES: subdivided meshes (16×10) interpolated in pixel space so edges follow the picture; canvases drawn with crisp type. Measured corners:
  - TV glass: [1282.5,414] [1468.3,398.2] [1469.5,541.2] [1286,524.5]
  - Left monitor: [208,438] [323,441] [323,533] [208,537]; right monitor: [331,441] [426,444] [426,526] [331,531]; laptop: [439,487] [497,489] [497,533] [439,535]
  - Portrait (inside the black frame): [1173,292] [1230,289] [1230,405] [1173,408]; photos printed with their own mat, 7 photos, arrows + counter + close, arrow keys
  - Stereo box on the console (hotspot only): rect [1348,590,1452,662]
- Monitors: left shows a site tour scrolling; right shows the next site. Selecting a site puts it on the left. Sites that allow framing (Viverst, Leathrock, Ayodele Daniel) load LIVE on the left monitor via a per-frame homography (`matrix3d`) of a real iframe; "Expand on the desk". Sites that refuse framing (Mojatech, Edithe Lekwachi, Tolu Afilaka) show the tour and their card opens the site in a new tab. Live frame loads with `location.replace` so it never adds browser history.
- Movement: drag only (no drift, no cursor-follow), settles in ~0.5 s; arrow keys; scroll/pinch zooms between the standing lens (60°) and an overview (82°); "See the studio" button.
- Camera: normal 24 mm-equivalent lens; push-in per object (fov 30–46).
- Interface grows out of the object: ring on the object → column of options beside it → detail card further out, on whichever side has room, clamped to the screen, follows a drag. Every popup has ×; "‹ Back" steps back one level; browser Back does the same; URL hash records position (`#monitors/2`).
- Light switches (two, by the door and by the TV) toggle day/night: a shader dims and cools the room while bright things stay lit. A night panorama would replace this with a crossfade.
- Sound: all synthesised (room tone, whoosh, click, shutter, page flip, switch); guide speaks via Web Speech; speaker button + volume slider, remembered in localStorage; arms on the first click (browser rule).
- Music: `public/studio/music.mp3` = **"Unlimited — the Olexweb anthem"** (made by Olaitan with Treblo; he owns it). Loops after first click, ♪ button, follows the slider, ducks under the guide's voice. Lyrics live in the stereo hotspot ("Now playing" / "Lyrics" sheet); text in `content/site.js` (`anthem`).
- The book: choosing an article on the shelf slides a book out, opens it, leaves turn (buttons, wheel, keys), "Read in full" goes to `/insights/[slug]`.
- Olex's AI: NOW a hand-modelled 3D body (smooth white lathed shell, glossy visor, lit eyes that blink, dark lower shell with green stripe, black base with glowing ring, "Olexweb" on body and base, soft shadow). Stands on the rug (spots at pixels [700,665] [850,690] [600,700] [780,640]), drifts slowly between them when idle, turns to face the visitor, face shows the words it says. `robot: true` in `components/Studio.jsx`. Verified it builds and renders in the room; Olaitan has NOT yet judged the look.
- A 3D stereo model exists in the code but is NOT added to the room (placeholder looked fake). Plan: paint a real stereo into the panorama, then map only lights on it.

## 4. The Next.js project (`olexweb-site.zip`)

- Next.js 14.2 (patched), React 18, three 0.128. `npm install`, `npm run dev`, `npm run build` all pass (31 pages).
- `content/site.js` — every word on the site. NO drafts remain; all copy is finished.
- `lib/engine.js` — the room engine (mirror of the preview's `scene6.js`, driven by cfg).
- `components/Studio.jsx` — mounts the engine on `/` (markup injected as HTML so ids match).
- Routes: `/`, `/olexweb`, `/work`, `/work/[slug]` (viverst, mojatech, leathrock, edithe-lekwachi, ayodele-daniel, tolu-afilaka), `/teaching`, `/vision`, `/contact`, `/olaitan`, `/ventures`, `/ventures/[slug]` (elvanex, needar, aviirel), `/lab`, `/thinking`, `/insights`, `/insights/[slug]` (4 articles), `sitemap.xml`, `robots.txt`. JSON-LD: Organization, Person (both name orders), WebSite, Article.
- Assets in `public/studio/`: `pano.jpg`, `sites/*.jpg` (tours, captured after scrolling), `photos/gallery-1..7.jpg` + `olaitan-1..7.jpg`, `mark.png`, `logo.png`, `music.mp3`. Favicon = the mark (app/icon.png, apple-icon.png).
- Laptop = "How Olexweb works" (services, process, Start a project). Monitors = selected web work. Notebook = the lab. Portrait = photographs/story. Wall = ventures. Shelf = insights (books). Window = vision/mission. TV = Learn with Olexweb. Phone = contact. Speaker = the anthem.

## 5. Where Olaitan's machine is

- Folder `C:\Users\adeba\Desktop\olexweb`, packages installed, builds; holds an OLDER version. Backup of the old original project: `Desktop\olexweb-old-backup.zip`.
- GitHub/Vercel: NOT pushed yet. The repo/Vercel project from the old site exists; plan is `git push --force` to replace it.

Update the folder from a new zip (run in VS Code terminal, inside the folder; check the zip's exact name in Downloads):
```powershell
Expand-Archive -Path "$env:USERPROFILE\Downloads\olexweb-site.zip" -DestinationPath "$env:TEMP\olexweb-new" -Force
$src = "$env:TEMP\olexweb-new\olexweb-site"
foreach ($d in "app","components","content","lib","public") { Remove-Item -Recurse -Force "$d" -ErrorAction SilentlyContinue; Copy-Item -Recurse "$src\$d" . }
Copy-Item "$src\package.json","$src\package-lock.json","$src\README.md" . -Force
npm install
npm run dev
```
Push (replaces the old code; Vercel rebuilds):
```powershell
git init; git add .; git commit -m "Olexweb studio: new build"; git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main --force
```
In Vercel Settings → General: Framework Preset = Next.js, Root Directory empty.

## 6. Known limits (say them, don't hide them)

- claude.ai artifact preview cannot frame other sites (live monitor only works locally/Vercel) and renders with a software renderer.
- The panorama is 1536 px wide at source; close-ups are soft. A 4096×2048+ regeneration of the same room fixes it (do this before any inpainting).
- 3D objects overlaid on a photo look "coded" unless painted into the photo; only lights/screens should be overlaid.
- Keyboard shortcuts don't reach the studio while the cursor is inside a live website frame.

## 7. Next steps, in order

1. **Olaitan judges the new Olex's AI model** (in the preview and `npm run dev`). Adjust size/materials/spots if asked.
2. **Inpaint the stereo** into the panorama (prompt below), send the new 1536×1024 JPG → measure the two drivers + display → map light rings, meter and glow that follow the music (same technique as the screens). Then delete the 3D stereo code.
3. **Optional: regenerate the panorama at 4096×2048+** (same room, stereo included, no robot) → replace `pano.jpg` → re-measure surfaces.
4. **Night panorama** (same prompt, night) → crossfade instead of the shader.
5. **GitHub push + Vercel**, verify live: live monitor sites, sound, music, mobile.
6. Later: lessons for Teaching, more insights, real photographs of the room if any.

### Inpaint prompt for the stereo (select the black box under the TV, x 1355–1445, y 592–662, +10 px margin)
> Replace the black box on the wooden console with a black hi-fi stereo unit sitting flat on the console top, the same width as the box it replaces. Matte black body with slightly rounded edges, two round speaker drivers side by side with thin dark metal rims, a small dark rectangular display panel in the centre between them, a thin brushed-metal strip along the top edge. The unit is switched off: no glowing lights, no text on the display. Photographed in the same room with the same lens and perspective as the surrounding photo, lit by the warm late-afternoon window light coming from the left, casting a soft shadow to the right and onto the wood behind it, with a faint reflection of the unit on the console surface. Realistic product photography, matte materials. Keep everything outside the selection exactly as it is.
Negative: glowing, neon, LED light, text, logo, cartoon, illustration, render, floating, transparent, blurry, extra objects.

### Panorama prompt (if regenerating; 2:1, 4096×2048 or larger, seamless)
> 360 degree equirectangular panorama, 2:1, seamless left-right wrap, photorealistic interior of a compact creative studio at golden hour. Straight ahead: window with a city skyline, curtains, AC unit above, a framed "A Small Room, A Big Digital World" print leaning on the wall. Left wall: walnut desk with two monitors (dark screens), open laptop, keyboard, headphones, black mug, notebook, ergonomic mesh chair, floating walnut shelves with books, cameras and plants, a city map poster, a vertical warm LED bar. Right wall: black steel bookshelf with books and camera gear, a framed portrait, a wall of pinned sketches, a wall-mounted TV (off) with soundbar, a black hi-fi stereo with two round drivers on a walnut console, a grey armchair with green cushion, a round side table with a smartphone. Behind: a dark wooden door, light switch, pegboard with headphones. Three-ring LED chandelier, beige tiles, grey shag rug. No people, no robot, no text on screens.

## 8. Content facts (do not invent beyond these)

- Selected web work (order matters, Tolu last): Viverst Global (viverst.com: main site, studio platform, agro platform, admin; full design+dev), Mojatech Electrical (mojatechelectrical.com: main site, products, admin; full design+dev), Leathrock (leathrock.vercel.app: site + admin), Edithe Lekwachi (edithelekwachi.vercel.app: site), Ayodele Daniel (ayodeledaniel.vercel.app: site), Tolu Afilaka Live (toluafilaka.com: frontend + admin).
- Ventures (Olaitan's): Elvanex Digital (digital/technology venture), Needar (SaaS for the LinkedIn job search), Aviirel (AI second brain).
- Key sentence: "Olexweb is built by Olaitan Adebayo, a creative ideator who uses technology, critical thinking, creativity and continuous learning to turn ideas into things."
- Vision: Olexweb exists to use thought, technology and creativity to create useful things that solve problems, expand possibilities and help people grow. Mission: to keep learning, think deeply, develop ideas and turn them into useful digital products, businesses, experiences and knowledge that create value for others.
- Books on the shelf (from the frames): Clean Code, Atomic Habits, The Psychology of Money, The Lean Startup.
- Anthem "Unlimited" lyrics are in `content/site.js` under `anthem`.
