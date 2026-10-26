# OLEXWEB — continue from here

Paste this whole file into a new chat with Claude and say: **"Continue from CONTINUE.md."**
(Optionally also upload a zip of the `olexweb-site` folder without `node_modules` and `.next`: the main repo is
private, so Claude can't read it from GitHub. The factory repo is public: github.com/Olexweb01-coder/olexweb-factory.)
Last updated: 24 October 2026.

---

## 1. Who and what

- **Olaitan Adebayo** (Olex), web and tech professional, Nigeria. Business: **Olexweb** (olexweb.com): a 360° studio
  website plus a private admin PWA at olexweb.com/admin with **Olex AI** (assistant, blog autopilot, research, memory).
- Stack: Next.js 14.2 on Vercel (fra1), Neon Postgres, Neon object storage (S3-compatible, private bucket),
  free AI provider pool (Gemini first, then Groq, OpenRouter, Cloudflare, etc.), Vercel cron + cron-job.org pinger.
- His machine: **Windows, PowerShell in VS Code**. Project folders on the Desktop:
  - `olexweb-site` → GitHub `Olexweb01-coder/Olexweb` (private) → Vercel deploys on push.
  - `olexweb-factory` → GitHub `Olexweb01-coder/olexweb-factory` (public) → GitHub Actions renders videos.

## 2. Working rules (always)

1. Every change is **built and tested before handover** (the test suites in `tests/youtube`); no breakage.
2. **Show a preview** (screenshots or video) before he downloads.
3. Be honest about limits; never guess when a check is possible (search, test).
4. Deliver changes as a **zip of only the changed files**, plus **one PowerShell block** that he pastes in his usual
   `olexweb-site` terminal. The block must: find each zip in Downloads by name (newest, even if renamed "(1)"),
   go into the right folder by itself (`olexweb-site` or `olexweb-factory`), unzip, run `npm run build` and
   `npm run admin:setup` (website, when the database changed), commit and push, stop with a red message on the first
   failure, skip "already up to date", and always return to `olexweb-site`. Keep lines short (long lines got jumbled).
5. He prefers speed, plain language, and no folder switching. Never ask him to paste secrets; if a secret appears in
   chat, have him rotate it.

## 3. The YouTube channel

- Channel **@olexweb** (display name "Adebayo Olaitan"), owned by **adebayoolaitan204@gmail.com**. Earlier Shorts were
  made with Abacus AI (April 2026); the "Secret websites you should know" Parts 1–8 did best (up to 224 views).
- Niche: **goldmine websites, tools, ideas and tech** that people thank you for: creativity, productivity, learning,
  ideas, fun, everyday life, useful AI, tech. For curious people of every kind, not only developers.
- Style (approved): faceless; a **stickman host drawn in code** with green glasses; real screen recording of the
  site in a browser frame; word-by-word captions (spoken word in green); infographics; synthesised sound effects;
  series badge "SECRET WEBSITES YOU SHOULD KNOW · PART N". Shorts 20–35 s, a cut every 1.5–3 s, hook in the first second.
- Goal: **fully autopilot, steady pace (one Short a day), never mass posting**, monetisation in the long run.
  YouTube Partner Program: from **1 Feb 2027** new channels need 8,000 watch hours in 12 months or 20M Shorts views in
  90 days, so a **weekly long video** is planned. About one video in four mentions olexweb.com in its description.
- Music must be commercially usable: **ACE-Step** (open source, commercial use allowed). Not MusicGen (non-commercial)
  or free Suno/Udio. Until ACE-Step is set up, music is synthesised in code (owned outright).

## 4. Setup done (accounts and keys; values are NOT here)

- Google Cloud project **"Olexweb Factory"** (under olexweb01@gmail.com, no organization), project number
  **121619580027**. YouTube Data API v3 and YouTube Analytics API enabled. Consent screen: External, **In production**,
  homepage/privacy/terms linked, domain olexweb.com. OAuth client **"Olexweb Admin"** (web), redirect
  `https://olexweb.com/admin/api/youtube/callback`. The client JSON is saved privately on his PC.
- Vercel (Production): `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `FACTORY_GH_TOKEN` (fine-grained, only olexweb-factory,
  Actions read/write, yearly expiry), `FACTORY_SECRET` (48 random characters; **also** a GitHub Actions secret in
  olexweb-factory; the two must match).
- YouTube is connected in the admin (scopes: youtube.readonly, yt-analytics.readonly, youtube.upload).

## 5. What's built (admin → YouTube: tabs Analytics · Ideas · Scripts)

- **Part 1 Analytics** (`lib/site/youtube.js`, `components/admin/YouTube.jsx`): OAuth with PKCE and a one-time state
  (the admin session cookie is SameSite=Strict, so the callback is proven by the state and a Lax state cookie, then a
  meta-refresh page returns him to the admin). Refresh token AES-256-GCM encrypted. Daily sync: channel, every upload,
  92 days of daily analytics, per-video stats; 7/28/90-day views; Shorts vs videos; "Moving now".
- **Part 2 Ideas** (`lib/site/ideas.js`): sources: Recomendo, Cool Tools, Kottke, Waxy, Open Culture, Free Tech 4
  Teachers, Sidebar (curated, main share), plus Show HN, Hacker News, GitHub and Olex AI evergreen picks; every site
  opened live (safe fetcher); judged on its own page; score /100 (value 30, wow 20, reach 15, fresh-on-YouTube 15,
  free 10, easy to show 10); unsafe or thin ideas turned down; at most 2 per category per search; YouTube coverage
  check (search.list) for the top 10; runs daily and on "Find ideas now"; parallel stages; live progress panel.
- **Part 3 Scripts** (`lib/site/scripts.js`): picked idea → 6–10 scenes (hook, demo, infographic, talk, url, cta;
  stickman pose; what to film), 3 titles, description, hashtags. Checked in code: 20–35 s, hook ≤ 12 words, 2+ site
  scenes, no year numbers, every number and claim backed by a quote found on the site's page (fetched fresh). One
  repair pass; else "Needs your eye" (Edit, or Approve anyway). Autopilot approves passing scripts.
- **Progress panel** (`lib/site/progress.js`, `components/admin/JobProgress.jsx`): stages, counts, countdown that
  learns from the last run, server download speed, heartbeat; for ideas, scripts, renders and uploads.
- **Part 4 Render factory** (repo olexweb-factory: `worker/run.mjs`, `worker/api.mjs`, `worker/voice.py`,
  `worker/sound.py`, `src/Short.jsx`, `src/Stickman.jsx`, `.github/workflows/render.yml` pinned to **ubuntu-24.04**).
  Admin "Send to the factory" (`lib/site/factory.js`) assigns the part number and starts the workflow with only the
  script id and admin address (public repo: nothing secret in inputs). Worker: job → film the site (Playwright, mouse
  wheel scrolling, pop-ups cleared) → Kokoro voice (kokoro-onnx 0.6.1) → synthesised music → Remotion 4.0.300 render
  (about 1 minute on GitHub) → sends the MP4 back in **1 MiB signed pieces** to `/api/factory/[action]` (HMAC with
  FACTORY_SECRET over time, method, path, body hash). Pieces go to the bucket with a 15 s deadline per try; if the
  bucket fails they go to the **database backup** (`yt_pieces`) and the bucket is skipped for that video. The admin
  plays the video with seeking. One render at a time; a run silent for 25 minutes is marked stopped. Reasons for any
  failure appear in the red "factory stopped" message.
- **Part 5 Upload** (`lib/site/publish.js`): resumable YouTube upload from the stored pieces (carries on after a
  dropped connection), not made for kids, Science & Technology, tags from hashtags, Private or Scheduled (Lagos
  time), then link + Studio link, stored copy deleted, idea marked made. **While publishing is Private (before the
  audit), Autopilot keeps finished videos as a backlog and uploads nothing; once Scheduled, it posts one a day.**
- **YouTube data rules**: privacy section `/privacy#youtube` and terms section `/terms#youtube` (both edited directly
  in `v2/legal/*.js`; also copy into the original templates). Disconnect deletes all stored YouTube data; access revoked
  at Google → deleted within 30 days; daily housekeeping keeps analytics 92 days (re-fetched), snapshots and coverage
  counts 30 days. `AUDIT.md` has the audit form answers and the screen-recording shot list.
- Tests: `tests/youtube` (README explains the sandbox setup): **173+ checks** with stand-ins for Google, Gemini,
  GitHub and the bucket; run them before any handover.

## 6. Where things stand right now

- The whole pipeline works on the real system: idea → script → factory on GitHub → video → YouTube.
- **Two videos are live** (72 and 28 views at last check). Uploads from the app arrive Private, but **Olex can switch
  them to Public himself in YouTube Studio** (they are not locked). Until Google's audit passes: Autopilot uploads one
  finished video a day as Private, his phone is notified, he taps Public in Studio. After the audit: Publishing →
  Scheduled, fully automatic, one a day at the chosen Lagos time.
- Series format (his request): every title is "Secret Websites You Should Know (Part N) | <hook title>", the voice
  opens with "Secret websites you should know, part N.", and a big PART N stamp shows for the first 1.5 s. The series
  name is a setting (he mentioned "Powerful websites you should know" as an alternative); parts continue from 9.
- Endings now ask viewers to comment (the site they want next, or whether they knew it) and follow for the next part.
- The factory uses the **full-precision Kokoro model** (the compact int8 one garbled some lines on some processors)
  and checks every recorded line; one broken video can no longer block the upload queue.
- To confirm at the start of the next chat: latest website and factory zips installed (`olexweb-youtube-series.zip`,
  `olexweb-factory-series.zip`), and `FACTORY_SECRET` replaced in both Vercel and GitHub.

- **Audit submitted** (24 Oct 2026) through the form, with the screencast (youtu.be/JDN4bR8BTRo, unlisted), an
  evidence image, architecture and user-flow diagrams and a supporting PDF. No verification email had arrived yet: if
  none comes, resubmit signed in as olexweb01@gmail.com (in Edge; Chrome extensions blocked the form's reCAPTCHA).
  When approved: Scripts → Publishing → Scheduled.
- **Long videos, twice a week** (Tue and Fri by default; settings on the Scripts tab): Autopilot writes a landscape
  video from the latest finds that already went out as Shorts (4–8 sites, a checked 45–75 s chapter each, intro and
  outro), titled "N Secret Websites You Should Know (Vol. V)"; the factory renders 1920×1080 (`src/Long.jsx`) and
  sends chapter times back; the YouTube description gets chapters. A long upload can go out on the same day as a Short.

- **Freebie funnel (Anatomy of Creation)**: `olexweb.com/me` redirects to his WhatsApp with an editable message
  (admin → Course & links; taps counted). People message him, save his number (he verifies), then he sends
  `olexweb.com/aoc`: name + "After listening, I'll share what I learned" tick, then every recording with play and
  download (nothing locked, by his choice), plus the Creation Map and "What did you learn?". Admin shows joined
  "x of 300", what each person played, downloaded or finished, their feedback, CSV export, editable content.
  Landing page rebuilt from his own copy (approved as a full-page preview first): opening states the offer (title, promise, free · 37 min · phone, Get free access, only 300 slots), then "Look around you" story, the question, the 4 parts, 5 points, who it's for, access card (name + tick → course with full-course download, waveform player, part by part, feedback), about, final call; its own header ("Main website ↗") and footer (one olexweb.com link). Visible by default (fade-up only below the fold, 2.5 s safety net); pre-built, refreshed every minute and at once when full or edited. Tests: fH.mjs (37), vis.mjs (30 on-screen checks, phone + laptop), perf.mjs. LESSON: always test that key parts are visible on screen, and show a preview before coding.
  UPDATE (new flyer): hero = the new landing card (public/aoc/card-*.webp) with the access box beside it on laptops; line "Why do some people create while others only watch?"; 00–04 points from the flyer; 100 slots (flyer v4): "Only 100 slots" → from 60 joins (60%) "Join fast. Few spaces left." → after 100 "Bonus spots opened"; never closes by itself; admin Close/Reopen sign-ups. One-time DB update (flyer_version 3) set goal 100 and cleared old saved content.
- **Domain:** olexweb.com moved from TrustName (de-accredited by ICANN; bulk-moved to Atak Domain) to Spaceship; DNS stays on Cloudflare (kiki/nick); registered until 22 May 2028 after transfer. DNSSEC off.
- **WhatsApp automation (planned):** keyword auto-replies on his existing number need coexistence → he wants to become a Meta Tech Provider (business verification; he may only have a SMEDAN certificate; CAC business name registration is the reliable fallback). Free up to 1,000 service replies/month (Meta pricing from Oct 2026). Meanwhile: Business app greeting message + /aoc quick reply. Main button: the full course as one MP3; "Or part by part" below. Styled after his flyer (AOC-Flyer-Final.png; the landing card is the hero). Audio (AAC 64k, levelled, from transcripts: Part 1 = lessons 00+01, Parts 2–4 = 02, 03, 04): `public/aoc/anatomy-of-creation-part-1..4.m4a` + `anatomy-of-creation-full-course.m4a`. "Close when the slots are full" switch (default on, as the flyer promises). (from his WhatsApp recordings, levelled to −16 LUFS, 96k MP3). The count shows only in the admin. Files: `lib/site/aoc.js`, `app/me`, `app/aoc`, `components/AocCourse.jsx`,
  `components/admin/AdminAoc.jsx`. The site anthem is silenced on /aoc.

## 7. Next steps, in order

1. **Wait for Google's audit reply** (olexweb01@gmail.com); answer any questions with help. Shot list and answers: `AUDIT.md`.
   Form: support.google.com/youtube/contact/yt_api_form, signed in as olexweb01@gmail.com; first question: "Complete a
   compliance audit to request for additional quota", explaining the aim is lifting the private-only restriction.
   Upload the recording by hand in YouTube Studio as Unlisted. After approval: Scripts → Publishing → **Scheduled**.
2. Keep making videos meanwhile (backlog).
3. **More views:** the learning loop (item 4) plus the weekly long video; keep posting daily.
4. **Weekly long video** (6–10 min "finds of the week" from the week's scripts and footage) — for monetisation.
5. **Part 6 learning loop** once 5–10 videos are up: 24 h / 72 h views and percentage watched feed topic and hook
   choice (keep stored YouTube stats within the 30-day rule; store only our own derived signals).
6. Better filming (act out each scene's "what to film"), Part 4b ACE-Step music, exact word timings for captions.
7. Investigate why the storage bucket hangs on uploads from Vercel (the database backup covers it for now).

## 8. Planned after the audit: a second channel (children's songs)

He has a children's-songs channel (under olexweb01@gmail.com). The same Google Cloud project can connect it (no new
setup), but the admin must support several channels (per-channel ideas, scripts, settings), and the factory needs a
new style: original songs (melody, lyrics, singing voice — e.g. ACE-Step, commercial use allowed), cartoon visuals,
"made for kids" rules (comments off, lower ad income) and care about YouTube's crackdown on mass-produced AI kids'
content. Add it after the audit is approved, since the audit describes one channel.

## 9. Phase 2 (after YouTube): Olex AI upgrade

- Voice chat rebuilt: professional, accurate, deeper thinking, still fast (better speech recognition and voice;
  route quick questions to fast models, hard ones to stronger reasoning).
- Wider abilities: create and edit images, search and read websites, schedules, alarms and reminders that notify the
  phone, meetings with people (scope first: booking and invites; joining calls is bigger), and more, ranked together.

## 10. Lessons learned (don't repeat)

- Incognito chats aren't saved: keep this file and `ROADMAP.md` in the repo.
- Run commands from the right folder; the one-block installer handles this now. (Once Part 5 went into the factory
  repo by mistake; it was removed and the factory history rewound with a force-push.)
- Never paste terminal output containing long random strings (secrets).
- Vercel cuts requests at 60 s here: anything that waits on another service needs its own deadline.
- GitHub's run logs for the public factory are readable by anyone: the worker never prints secrets or signed URLs.
- Video pieces: 1 MiB (Vercel's request limit is 4.5 MB; YouTube wants multiples of 256 KiB).

## YouTube Stage 1 (built): queue, Videos tab, posting times, safe Disconnect
- Queue: yt_scripts.queue_pos; uploads ONLY from the queue, one per daily slot (publish_time, optional publish_time2 = 2 a day),
  each upload records its slot (upload.slot "YYYY-MM-DD HH:MM"). Private mode: uploads at the slot time; Scheduled: publishAt
  the next free slot (today/tomorrow only). Autopilot auto-queues finished videos; "Post now" (confirm) is the only bypass
  (upload.special; doesn't use a slot). Long videos take a slot like any other. lib/site/publish.js (queueList, uploadNext, ...).
- Videos tab: components/admin/YouTubeVideos.jsx (all classes prefixed yv-: admin's global .vc/.act/.chip clashed).
- Best times: YouTube Analytics has no hourly data, so bestTimes() learns from his own Shorts (median views by Lagos posting
  hour, needs 8+ videos and 2+ hours); until then START_TIMES 12:00 / 18:00 / 20:00 with reasons.
- Disconnect: dialog + server both require typing DISCONNECT.
- Tests: fQ.mjs (queue + two-a-day), fD/fD2/fE/fG3 use post-now. Note: run3 (ideas) fails in the sandbox only because the
  sandbox can now reach the live internet (real feeds mix into fake test data); not a code problem.
- Next: Progress tab (preview first), then Course & links redesign (preview first).
