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
- Best times (built): weekly research (youtube.js researchPostingTimes): 4 niche searches of Shorts from the last 30 days
  (order=viewCount, ~400 quota units/week) → per-Lagos-hour median views/day (summary only, deleted after 30 days and on
  Disconnect) + viewers' countries (Analytics, dimension=country). publish.js bestTimes() ranks hours: niche 50%,
  audience-awake 30%, own results 20%; top 3, ≥2 h apart, each with its reasons. "Research now" (1-hour cooldown).
- Status: checkUploads() asks YouTube (videos.list part=status) for Private/Public of recent uploads; on opening Videos
  (at most every 10 min) and "Check status". Cards: "Posted to YouTube · date, time · Private/Public (checked x ago)".
- Tests: fT.mjs (research, status, Disconnect clean-up). Stand-in Google: niche search, countries, /_privacy.
- Progress tab (built): lib/site/progress.js progressPage() + components/admin/YouTubeProgress.jsx: Needs you (failed with
  reason + Try again = send-to-factory; needs_review → Scripts; silent factory job >6 min → Needs you) · In progress
  (factory with stages/eta, ideas/script/upload jobs) · Finished (last 24 h). Auto-refresh every 4 s while running.
- Course & links redesigned (components/admin/AdminAoc.jsx): sections Overview · People · Feedback · WhatsApp link ·
  Course settings; header with live status, View the page, Close/Reopen sign-ups. Same API actions as before.
- Next ideas: Instagram Reels + Facebook Reels publishing from the same queue (Meta app, own Business account, no app
  review needed for own account; IG limit 100 API posts/24 h). TikTok needs an audit (private-only until then).

## Pages & links: Install 1 (built)
- lib/site/pages.js (pages, sign-ups with AOC-style stages, short links to WhatsApp or any https URL, AI draft/suggest that never
  invents facts), app/[slug]/page.js (catch-all, cached per page: generateStaticParams []), components/PageView.jsx (webinar,
  event = dark opening + flipping date card, audio course), components/LinkHop.jsx, admin: /admin/pages (AdminPages.jsx),
  /admin/pages/[id] (PageEditor.jsx: Edit · Overview · People · Feedback · Settings, live phone preview).
- Nav "Course & links" → "Pages & links"; AOC stays at /admin/aoc and /aoc (its own tables), shown as the first card.
- Community link is only returned after sign-up (never in the public page data). Audio files likewise.
- Reserved addresses: RESERVED in pages.js (all app routes + public folders); update it when adding new top-level routes.
- Editor lesson: never define components inside a component (inputs lose focus); helpers are called as functions.
- Style lesson: `.pv :where(a){color:inherit}` (a plain `.pv a` rule overrode button text colours).
- Tests: fPG.mjs (40), vPG.mjs (14 on screen, incl. typing focus and readable buttons), pPG.mjs (speed).
- Install 2 next: uploads straight to the bucket (photos with a 4:5 chest-up cropper, audio) + full-page preview.
- Install 2 (built): audio uploads in 3 MB pieces through /admin/api/pages/upload (lib/site/pagefiles.js, bucket keys aud/<id>/<n>,
  table page_files), streamed at /media/a/<id>.<ext> (Range: one piece per answer; no Range: whole file streamed in order).
  Photos: components/admin/Uploaders.jsx PhotoUpload crops in the browser (4:5 chest-up guide; 1.91 for link previews) and posts
  to the existing /admin/api/upload (WebP, /media/img/...). Full preview: /admin/pages/[id]/preview (saves first).
  Housekeeping helper dropUnfinished() exists for half-uploaded files (not yet scheduled). Tests: fUP.mjs (14).

## The Olexweb Directory (built): the marketing engine's first piece
- Lane: useful tools, AI and tech for creators and small businesses (he chose this; no general/sports news, which carries
  spam-policy, AdSense, accuracy and legal risk).
- lib/site/editorial.js: RULEBOOK (AI instructions) + checkEntry (HARD checks: ≥3 facts each with an exact quote from the site,
  pricing only with proof, banned hype/filler words, no emoji/!, lengths; quality score). Failing pages stay private drafts.
- lib/site/directory.js: writeEntry (reads the site: title + meta description + text; thin <400 chars refused; one repair
  pass), directoryRun (quick run: 2 per run, daily cap dir_settings.per_day default 12, best research ideas first, score ≥55),
  IndexNow announce (key = sha256('indexnow:'+AUTH_SECRET)[0:32], served at /api/indexnow), views/leads (dir_daily).
- Public: /tools (DirLibrary.jsx: search, categories, price), /tools/[slug] (DirEntry.jsx: facts with quotes, Short via
  click-to-load, how to start, our take, FAQ + JSON-LD WebPage/Breadcrumb/FAQPage, alternatives, offer = newest live page →
  else AOC → else /me, tracked ?from=tools-<slug>). Sitemap includes them. Admin: /admin/directory (AdminDirectory.jsx).
- Runner: olexweb-factory/.github/workflows/olex-runner.yml pings /api/assistant/cron?run=due every 10 min (needs the
  CRON_SECRET repo secret). Vercel's own cron only runs twice a day.
- Next: news briefs (sourced explainers), comparisons/guides from directory facts, free tools, Search Console learning loop,
  Instagram/Facebook Reels, affiliate links.
- Blog pace (built): 1–21 articles a week (DB check, API, schedule, chat, settings UI with 1/2/3/5/7 + Custom in the
  "How it works" tab). gapHours: ≤3/week → 48 h; above → max(6, floor(168/pace·0.8)). Above 3/week the quick run also
  drafts (draftIfDue) and refreshes research at most every 6 h (assistant_settings.research_at). Mode (approval/autopilot)
  is shared by the blog AND YouTube scripts. Tests: fPACE.mjs (8).
- YouTube's own mode (built): yt_settings.yt_mode ('approval'|'autopilot'), copied once from assistant_settings.mode;
  used by scripts.js, longform.js, autopilot quickRun (factory/queue) and the Videos tab. Switch at the top of the Scripts tab
  (action yt-mode). The blog keeps assistant_settings.mode. Pace stays separate (blog pace vs YouTube posting times).
- Guide links (built): publish.js guideLines() puts "Full guide (free): https://olexweb.com/tools/<slug>" as the FIRST line of
  each Short's description (long videos: a list per site), only for live Directory pages. The Directory writes sites with
  videos on the way first. Older Shorts: YouTube scopes are readonly + analytics + upload (no videos.update, and adding
  youtube.force-ssl would affect the audit), so Admin → Directory lists them with Copy line / Open in Studio / Done
  (dir_entries.yt_linked_at). Tests: fYT0.mjs + fYT.mjs (in phaseD).
- Facebook Reels (built): lib/site/meta.js with Meta app "Olexweb Publisher" (dev mode, own Page; env META_APP_ID,
  META_APP_SECRET, META_CONFIG_ID; Facebook Login for Business config with pages_show_list, pages_read_engagement,
  pages_manage_posts). Connect: /admin/api/meta/connect → Meta → /admin/api/meta/callback (state hashed, 15 min; admin user
  ids are TEXT). Page tokens encrypted (meta_pages). Posting: Reels API start → rupload bytes → finish PUBLISHED, caption =
  title + guide link + hashtags. Shorts only. A Short is marked fb={status:'pending'} at YouTube upload ONLY when its copy is
  kept for Facebook (else dropped as before); poster picks pending/failed(<3 tries); pending >4 days → dropped+skipped.
  Daily limit counts meta_posts (log of every Reel). Serious Meta errors (190, 368/blocked, 10/200/3) pause + notify
  (kind 'facebook'). Panel at top of YouTube → Videos. Privacy page has #facebook / #facebook-deletion. Instagram: off
  (ig_enabled) until that account is stable. Tests: fFB0.mjs + fFB.mjs in phaseD (75 pass).
- Meta callback (fixed): like YouTube's, it's in middleware OPEN; proven by the one-time state (DB, 15 min, made by the owner) + a Lax 'olex_meta_state' cookie set at connect; returns a tiny page with meta refresh so the Strict session cookie travels again. redirect_uri always SITE_ORIGIN() (https://olexweb.com). Meta app: the Valid OAuth Redirect URI must be a saved TAG (typed, no leading spaces) and the Website platform added.

## Automation, install 1 (28 Oct 2026)
- New admin section **Automation** (/admin/automation): tabs Overview · YouTube (the existing /admin/youtube pages, under the
  Automation heading; old links work, sidebar highlights Automation) · Facebook (/admin/automation/facebook) · Instagram (off).
- Facebook has its OWN posting times (meta_settings.times, 1–3 a day, ≥2 h apart, Lagos) and its OWN queue: any finished Short
  with its copy in storage (status rendered, or uploaded and fb pending/failed within 4 days), in part order. It does NOT wait
  for YouTube. A slot is filled at most 3 h late; never two Reels within 60 min; meta_posts.slot records the slot.
- Storage: a copy is deleted only when YouTube has it AND Facebook has posted it (or doesn't want it / gave up after 4 days or 3 tries).
- Facebook caption: hook (title) · first sentence of the description · Full guide link (if live) · 3 hashtags (fbCaption).
- Switching YouTube to Autopilot approves waiting drafts (needs_review still waits). Progress: "Waiting for your review".
- Overview: production check (need = bigger of the channels' per-day, made per day this week, ready videos, days left) with
  Make more (send next approved to the factory, else write the next script); a card per channel; Needs you.
- Tests: tests/youtube/fAU.mjs (34 checks); phaseAU.sh = phaseD + fAU (110 checks, all pass). resetD.sh + seedD.sql give a clean
  test database (fresh DBs lacked sample ideas tldraw/PaletteForge/Queue* that the old sandbox had). Run long suites detached:
  setsid nohup sh -c '...' & (plain background jobs are stopped between steps).
- Next: install 2 = Library tab (per-channel ticks, Add your own idea).

## Meetings, install 1 (2 Nov 2026)
- Video meetings on **LiveKit** (LiveKit Cloud free tier now, 5,000 min/month; own server on Oracle later = change 3 Vercel
  settings only): `LIVEKIT_URL` (wss://…), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. Packages pinned: livekit-client 2.22.4,
  livekit-server-sdk 2.19.1 (installs that add packages must run `npm install` in the PowerShell block).
- Only the owner hosts (Admin → Meetings, `/admin/meetings`, AdminMeetings.jsx); public sign-up for hosts comes later.
  Anyone with the link joins at `olexweb.com/meet/<code>` (codes like `kfd-wmpq-zrt`, letters without i/l/o) with just a name.
- `lib/site/meet.js`: create/list/end/delete, `joinMeeting` (signed token, 6 h; host = owner session, identity `h_…`, guests
  `g_…`; only the server sets identities), `hostAction` (allow-speak / stop-speak / remove via RoomServiceClient), room limit 100.
  "Who can speak": everyone, or invited (guests listen, chat, raise a hand; the host lets them speak). Guests wait until the
  host starts (`started_at`); ending deletes the LiveKit room. Table `meetings` (schema.sql).
- Routes: `/api/meet` (public; GET state + whether the asker is the host, POST join; same-site only), `/admin/api/meetings`
  (owner). The meeting page is OUTSIDE the admin middleware, so the admin's strict CSP/camera block are untouched.
  Opened from WhatsApp, the Strict session cookie isn't sent with the page load: the page re-asks `/api/meet` (same-site
  fetch carries it) and switches to host. `meet` is in RESERVED (pages.js).
- Room (`components/meet/MeetRoom.jsx`, styles `app/meet/meet.css`, all classes `mt-`): lobby (name, mic, camera preview,
  Data saver), tiles 16:9 on wide screens / filling on phones, voice ring from live audio level, chat (LiveKit data, topic
  'chat', not stored), raise hand (participant attribute `hand`), screen share, People panel with host controls, Leave vs End
  for everyone. Weak-network setup: adaptiveStream + dynacast, 360p max, simulcast 90/180, speech audio with RED + DTX, only
  9 tiles get video, Data saver unsubscribes cameras. livekit-client loads after the page appears (first load 96 kB).
- Tests: `tests/meet/run.sh` (local `livekit-server --dev`, next start, Postgres; 64 checks with two real Chrome browsers,
  host laptop + guest phone). The binary: github.com/livekit/livekit releases (linux_amd64).

## Meetings, install 2 (3 Nov 2026): recording, reactions, emoji
- Recording (host only, `components/meet/recorder.js`): "Record this meeting?" on starting (Video and audio / Audio only),
  Record button always on the bar (shows the running time), red Recording badge for everyone (host participant attribute
  `rec`; only an `h_` identity counts), guests told when it starts/stops and on joining late. Nothing goes to the server.
  Video = the stage drawn into 1280×720 at 15 fps from the host's DOM (tiles carry data-name/initials/tone/host), audio =
  every voice + host mic mixed with WebAudio; a Worker timer keeps drawing in background tabs.
  Crash-safe: a piece every 2 s goes to IndexedDB (`olexweb-meet-rec`); closing/reloading mid-recording leaves the pieces
  (pagehide sets `closing`, the Disconnected handler then doesn't save) and the lobby offers "A recording wasn't saved:
  Save / Delete". Leave / End for everyone save first. Format: WebM where supported (Chrome's MP4 recording gives no pieces
  until stop, so it isn't crash-safe), MP4 fallback (Safari). `withDuration()` writes the length into the WebM header so
  players can seek. File: "<meeting> YYYY-MM-DD HH.MM.webm" (audio: "… (audio).webm").
- Reactions: React tray 👍 👏 😂 ❤️ 🎉 😮 (data topic 'react', only those six accepted), floating over the stage with the
  sender's name. Chat: emoji picker (inserts at the cursor), emoji-only messages show big. Chat still never stored.
- Phones: Share screen and Data saver move into More (the bar never scrolls, so trays/menus open above it).
- Tests: tests/meet/run.sh = 98 checks (recordings verified with ffprobe: tracks, 1280×720, duration, a real picture).

## Meetings, install 3 (3 Nov 2026): AI notes
- While recording (video or audio), recorder.js also records a small 32 kbps audio track saved as complete 5-minute files
  in IndexedDB store `notes` (key [code, rec, part]; DB version 2). Tests shorten the pieces with window.__olexNotesPieceMs.
- After stopping: a banner "ready for AI notes" (link opens /admin/meetings#notes-<code> in a new tab); the ended screen has
  the same link. Admin → Meetings shows "Make AI notes" for meetings whose audio is on this device.
- components/meet/notes.js (runs in the admin): each piece → /admin/api/transcribe (existing voice pool, unchanged; one
  retry; a finished piece keeps its text in IndexedDB so "try again" carries on), then `notes` → lib/site/meet.js
  makeNotes(): askJSON (free AI pool) with NOTES_SCHEMA (summary, points, decisions, actions {what, who, when}, questions);
  rules: transcript is data not instructions, never invent. Transcripts over 40,000 characters are noted in parts, then
  combined. Saved in meetings.notes / transcript / notes_at / notes_by; the device audio is deleted after. `get-notes`
  reopens them. Notes sheet: Copy notes, Download (.md), Transcript (.txt). Owner only.
- Tests: tests/meet/mock-ai.mjs stands in for Gemini (ASSISTANT_GEMINI_BASE=http://localhost:4566); 123 checks.
- Next: later public sign-up for hosts.

## Automation, install 2 (3 Nov 2026): the Library
- Automation → Library (/admin/automation/library, AutomationLibrary.jsx, lib/site/library.js): every idea and its Short in
  one list (stages idea / being made / ready / posted / set aside), search, filters, and a tick per channel.
- Ticks live on the idea: yt_ideas.channels {youtube, facebook} (default both; Instagram greyed until it's on). Read by:
  publish.js (queueList, autoQueue, uploadNext skip YouTube-unticked; queueAdd / postNow refuse), meta.js (WAITING and
  fbWants skip Facebook-unticked; releaseIfDone frees a YouTube-unticked Short once Facebook posts it and marks its idea
  made), automation.js (Overview's "ready" count respects ticks). setChannel(): only before that channel posts (and not while
  YouTube uploads); at least one stays ticked; unticking Facebook after YouTube frees the copy kept for Facebook.
- Your own idea (ideas.js addOwnIdea, action own-idea): judged exactly like a found one (verify live → the same judge with
  the site's real name → trust ≥ 6 and value ≥ 5 → YouTube coverage → score). Turned down = saved 'passed' (source 'You')
  with the reason. Make it next = picked + yt_ideas.first: first in writeNextScript, sendNext, YouTube's queue (front) and
  Facebook's queue. Actions on /admin/api/youtube: library-channel, own-idea.
- Fixed: the Automation screens' <style> text children (quotes escaped by React on the server → broken rules such as the tab
  underline, and hydration errors that re-rendered every Automation page). Now <style dangerouslySetInnerHTML> (fixed CSS).
- Tests: tests/youtube/fLIB.mjs (47), chain phaseLIB.sh = phaseAU + fLIB, with fD.mjs skipped: fD.mjs still calls the
  `upload` action removed when uploads moved to the queue (commit 3072f46), so phaseAU stops there on current code. Without
  it the chain gives 96 passed + 1 failure in fD2.mjs (it depends on fD's setup), identical before and after the Library.
  The factory repo's tests need out/video.mp4 in olexweb-factory (any vertical MP4, e.g. made with ffmpeg testsrc2).

## Meetings, install 4 (3 Nov 2026): scheduling and reminders
- meetings.starts_at (UTC; picked in Lagos time, UTC+1 all year), minutes, reminders (minutes before, sorted), reminders_auto
  (smart), reminded (sent), start_notified_at. lib/site/meet.js: smartReminders() (>1 day → 1 day, 1 h, 30 min; later today →
  1 h, 30 min; very soon → one of 10 or 5 min), createMeeting/updateMeeting (rescheduling clears `reminded` and recalculates
  smart ones; your own stay), meetingReminders() in quickRun (lib/assistant/autopilot.js, every 10 minutes): sends only the
  nearest due reminder (missed older ones are marked, not sent late), each once, none once you've started; "starting now" at
  the start time. notify kind 'meeting' (also a switch in Notifications.jsx), link /admin/meetings#meet-<code>.
- calendarFile(): /api/meet?calendar=1&code= (iCalendar, two alarms built in). Guest page (MeetRoom When): Lagos time, the
  guest's own time, "Starts in…", Add to Google Calendar / Apple or Outlook. Rendered only in the browser.
- Admin → Meetings: Start now / Schedule (date, time Lagos, length), reminder chips (smart or your own), Copy invite, Edit sheet.
  Dates there use our own formatter (DAYS/MONTHS, UTC+1), not toLocaleString: Node and Chrome punctuate differently
  ("Tue 3 Nov" vs "Tue, 3 Nov"), which caused React hydration errors (a bug since install 1, fixed here).
- Tests: tests/meet/schedule.py (47; run by tests/meet/run.sh after e2e.py; CRON_SECRET set there). The admin's CSP blocks
  Playwright's wait_for_function (string eval): use element waits on admin pages.
- Notifications.jsx's own list still lacks switches for 'facebook', 'ideas' and 'window' (the server has them, on by default).
- Next: install B = Olex AI actions (meetings, schedule, automation, courses) through tools.js (sectionData → proposeMore → runMore).

## Olex AI, install B (3 Nov 2026): meetings, schedule, automation, courses
- lib/assistant/ops.js, plugged into tools.js's three steps: opsData() (appended to sectionData; sections MEETINGS (by
  code, with recent AI notes), SCHEDULE (next 8 days: meetings, scheduled changes, auto-publishing articles, YouTube and
  Facebook queues; NOW in Lagos), AUTOMATION + LIBRARY (idea #id, ticks, locks), COURSES (AOC; listener #id, first names
  only, feedback scrubbed and marked data). chat.js attaches site data for OPS_SITE_WORDS too.
- OPS_ACTIONS (each validated in proposeOps against real records, label in plain English, run by runOps after Do it):
  schedule_meeting, update_meeting, end_meeting*, delete_meeting* (ended only), set_channel, add_idea (judged like found),
  make_next, decide_idea, youtube_mode, facebook_posting, course_accepting, course_goal, remove_listener*.
  * = danger: red card (ChatHome .actcard.danger, red Do it) whose label says what's lost. The old "never delete" rule now
  reads: delete or end only through those actions. Asking for what's already so gives no card.
- setYoutubeMode() moved to lib/site/automation.js; the YouTube route and Olex AI both call it (same behaviour).
- A new course: add its data to COURSES in opsData and its actions next to course_accepting / course_goal.
- Tests: tests/meet/olex.py (44; the AI's reply is set by the test through tests/meet/mock-ai.mjs /control chatReply, so it
  checks our side: data, cards, validation, danger, once-only, cancel). Whether the real model proposes well: try it live.

## Olexweb Meet as its own app, install 1 (3 Nov 2026): meet.olexweb.com and accounts
- Address: next.config.js rewrites/redirects with `has: host meet\..+`: / → /meet (MeetHome), /<code> → /meet/<code>,
  /manifest.webmanifest, /sw.js, /favicon.ico, /apple-touch-icon.png → public/meet/*; every other path on the Meet address
  goes to MAIN_ORIGIN (default https://olexweb.com). MEET_ORIGIN (runtime) turns on: links on the Meet address
  (meetLink), guests on olexweb.com/meet/<code> forwarded there (Olaitan, signed in to the admin, stays), olexweb.com/meet →
  Meet home. Don't set MEET_ORIGIN in Vercel until meet.olexweb.com's DNS works.
- PWA: public/meet/app.webmanifest, sw.js (offline page only; caches nothing private), icon-192/512, maskable-512,
  apple-touch-icon, logo-96; app/meet/icon.png + apple-icon.png. Icon = approved design I2 (green, dark camera, logo badge).
- Accounts (lib/meet/auth.js): Google, Microsoft, GitHub, Facebook OAuth (MEET_GOOGLE_CLIENT_ID/_SECRET, MEET_MICROSOFT_…,
  MEET_GITHUB_…, MEET_FACEBOOK_APP_ID/_SECRET; a button shows only when its keys exist). Return address:
  <MEET_ORIGIN>/api/meet/auth/<provider>/callback. State signed with AUTH_SECRET in a 10-minute cookie; PKCE for Google and
  Microsoft. Accounts merge by email only when verified (Google, GitHub); Microsoft/Facebook stay separate. Owner = verified
  sign-in with the admin owner's email. Cookie __Host-meet_sess (HttpOnly, Secure, Lax; SHA-256 stored). Banned accounts
  (meet_users.banned_at) are signed out and refused. Routes: /api/meet/auth/[provider](/callback), /api/meet/me.
- Hosting: isHost() in lib/site/meet.js: admin owner; or the Meet account that made it (meetings.host_user); or the owner's
  Meet account for admin-made meetings. /api/meet/host (host controls for any host), /api/meet/mine (a Meet account's list,
  create, update, end, delete; fair use 30/day, 50 open). OWNERS filter keeps other people's meetings out of Admin →
  Meetings, phone reminders and Olex AI. Deleting a Meet account deletes its meetings (FK on delete cascade).
  AI notes and phone reminders stay Olaitan's; other hosts' guests use calendar invites.
- Database: lib/meet/db.js uses MEET_DATABASE_URL(_POOLED) when set, else the main DB. db/meet-schema.sql (meetings +
  meet_users, meet_identities, meet_sessions) is applied by admin-setup step 2b; the first run against an empty Meet DB copies
  the meetings across exactly (row_to_json → json_populate_record), never twice.
- Tests: tests/meet/app.py (61) with tests/meet/mock-oauth.mjs (checks state, secret, return address, PKCE); run.sh restarts
  the site with MEET_ORIGIN=http://meet.localhost:3000 for it (Chrome sends *.localhost here).
- Next: install 2 = guest details form (optional per meeting; name always; phone/email required/optional/off; extra
  optional fields; kept 30 days by default, host can change) + attendance list after the meeting + CSV, Report, bans in admin.

## Olexweb Meet, install 2 (3 Nov 2026): guest details, attendance, reports, bans
- meetings.form (jsonb, null = none): { phone, email: required|optional|off, org: bool, question, keep: 30|90|365|0 }. Set in the
  Meet app's Schedule/Change sheet and Admin → Meetings (components/meet/Guests.jsx FormSettings). Instant "Start now" meetings
  have no form (schedule one, or use Change before starting).
- lib/meet/guests.js: cleanForm/publicForm/checkDetails (name always; consent required; phone and email checked on the server),
  recordJoin → meet_attendees (one row per join; hosts never), leave times from LiveKit's signed webhook (/api/meet/livekit,
  WebhookReceiver; set in LiveKit → Settings → Webhooks) and the browser's signed beacon (/api/meet/left, HMAC key from join),
  endMeeting closes everyone's time. attendance() only after the meeting ends, for its host (mustHost); CSV with BOM and
  formula-injection guard (/api/meet/attendance?code=&format=csv); delete early. forgetOldDetails() in quickRun.
- Reports: /api/meet/report (spam|abuse|illegal|other, note; ip only as a hash; 1 per meeting per 10 min, 5 an hour).
  Admin → Meetings → Meet app (AdminMeetApp.jsx; actions meet-admin, ban, unban, dismiss): banning signs them out, ends their
  open meetings, marks their reports acted on; the owner can't be banned.
- Tests: tests/meet/guests.py (51); LiveKit runs with tests/meet/livekit.yaml (webhooks to the site).
- Still to do: install 3 (usage meter and capacity protections), install 4 (pricing, built but switched off).

- Fix (3 Nov 2026): admin-setup's first copy into Meet's own database now carries every Meet table in dependency order
  (meet_users → meet_identities → meet_sessions → meetings → meet_attendees → meet_reports), all-or-nothing. The first
  version copied only meetings and failed (meetings_host_user_fkey) when a meeting belonged to a Meet account.

## Olexweb Meet, install 3 (4 Nov 2026): usage meter, pause, notes in the Meet app, tabs, tidy addresses
- lib/meet/usage.js: meet_usage rows from LiveKit's signed webhook (participant_joined/left, room_finished; via guests.js
  livekitEvent), minutes this month (sessions never reported closed stop counting after 6 hours), meet_settings limits
  (presets: LiveKit free 5,000 min / 100 people, $50 150,000 / 1,000, $500 1.5M / 5,000). usageWatch() in quickRun: push
  'usage' once a month at 80% and 95%. canCreate (Meet accounts paused at 95%, Olaitan never), canJoin (people-at-once
  limit for everyone: "Meet is full right now"; at 95% other hosts can't start a not-yet-started meeting; started meetings
  always let people in). Admin → Meetings → Usage tab (AdminMeetUsage.jsx); actions usage, limits.
- Pause recording: MeetRecorder.pause()/resume() (main and notes recorders); meta.pausedMs keeps the file length right;
  host attribute rec='paused' → "Recording paused" for everyone.
- AI notes in the Meet app: /api/meet/notes (transcribe a piece, write, read) for any host; free first 60 minutes
  (meetings.notes_pieces < 12, claimed before transcribing, given back on failure; 402 after); Olaitan unlimited.
  components/meet/notes.js takes routes (ADMIN or MEET_ROUTES). NotesPanel (Guests.jsx) in the room, ended screen and
  Meet home. "AI notes" switch = MeetRecorder notesOnly (pieces only, no file), attribute notes='1' → badge.
  Reason: recordings made on meet.olexweb.com live in that address's IndexedDB; olexweb.com/admin can't see them.
- Admin → Meetings has tabs: Meetings, Usage (#usage), Accounts and reports (#accounts).
- lib/admin/dburl.js tidyDbUrl(): strips quotes, NAME= in front, psql wrapper, extra lines; else names the setting.
  Used by lib/admin/db.js and lib/meet/db.js. Admin → Meetings shows a clear message if Meet's database fails.
- Tests: tests/meet/usage.py (30); e2e.py updated for in-meeting notes. All suites: 122+47+44+61+51+30.
- Next: install 4 (floating mini window / picture-in-picture, noise cancellation, background blur, MP3 audio recordings),
  install 5 (SEO for meet.olexweb.com, email sign-up with password and codes via an email service, designed emails).

## Olexweb Meet, install 4 (4 Nov 2026): noise cancellation, blur, MP3, mini window, iPhone
- New packages (exact, each 2+ weeks old when added): @livekit/track-processors 0.8.2, @sapphi-red/web-noise-suppressor 0.4.1,
  @breezystack/lamejs 1.2.7. The install block runs npm install.
- components/meet/effects.js: RNNoise as a LiveKit audio processor (on by default; files in public/meet/noise), background
  blur via BackgroundProcessor with MediaPipe served from public/meet/vision (model selfie_segmenter.tflite, ~19 MB of wasm,
  loaded only when blur is switched on). Choice remembered in localStorage 'olexweb-meet-effects'. Lobby chips + More menu.
  The room root has data-noise / data-blur = what's really running (tests use it).
- components/meet/pip.js: MiniWindow (Document Picture-in-Picture on Chrome/Edge desktop with Mute, Camera, Leave, Back;
  otherwise canvas → video requestPictureInPicture), callControls (Media Session togglemicrophone/togglecamera/hangup and
  enterpictureinpicture = Chrome's automatic PiP for calls), callState. "Mini window" in More.
- More is now on computers too, listing only what isn't on the bar (.mt-menu button.mt-narrow hidden ≥761px).
- MP3: audio-only recordings are MP3 (public/meet/pcm-worklet.js → components/meet/mp3worker.js, LAME), mono, 64 kbps
  (Standard) or 96 (High), saved every 2 s like other recordings; pause stops the feed. Video stays WebM.
- recorder.js lengthWritten(): writes the WebM length using enough of the file's start (harmless robustness). An
  intermittent "video recording without a length" was seen once in a busy test run; not reproduced since; cause unknown.
- iPhone/iPad: Apple pauses a web page's mic in the background. Others see "Stepped away (iPhone pauses the mic)"
  (attribute away), the mic restarts on return if it was on, and a lobby tip. True background audio needs a native app
  (LiveKit iOS/Android SDKs with CallKit) — a possible later phase.
- Tests: tests/meet/effects.py (33). All suites: 122+47+44+61+51+30+33.
- Next: install 5 (SEO for meet.olexweb.com; email sign-up with password and codes via an email service; designed emails).

## Install 5 (4 Nov 2026): search, Olexweb Mail, email sign-in, own mail server
- SEO for meet.olexweb.com: lib/meet/seo.js (title, description, FAQ shared by page and JSON-LD), og image public/meet/og.png,
  /robots.txt and /sitemap.xml on the Meet address → /api/meet/seo/[f]. Tests: tests/meet/seo.py (15).
- Olexweb Mail (lib/mail): sendMail() for the whole site; pipes own → resend → mailjet (lib/mail/pipes.js; switched on by
  OWN_MAIL_URL+OWN_MAIL_TOKEN, RESEND_API_KEY, MAILJET_API_KEY+MAILJET_SECRET_KEY; limits *_DAILY_LIMIT / *_MONTHLY_LIMIT,
  Resend default 80/day shared with Belloft). Codes first (non-urgent mail only to 80% of a day). Failover in the same
  request; a failing pipe rests 1,2,4…30 min. Tables mail_messages, mail_suppressions, mail_pipe_days, mail_pipes (main DB).
  Admin → Mail (/admin/mail, AdminMail.jsx; /admin/api/mail). Delivery reports: /api/mail/events/resend (Svix-signed,
  RESEND_WEBHOOK_SECRET), /api/mail/events/mailjet?token=MAIL_EVENTS_TOKEN, /api/mail/events/own (Bearer OWN_MAIL_TOKEN):
  permanent bounces and complaints → do-not-send. Tests: tests/mail/mail.py (45, stand-in tests/mail/mock-pipes.mjs).
- Email sign-in for Meet (lib/meet/emailauth.js, /api/meet/email, components/meet/EmailSignIn.jsx): sign up with a code,
  password or emailed code, forgot password; scrypt hashes; codes hashed, 10 min, 5 tries; limits per address/network;
  no account enumeration; same verified email = same account (upsertUser). Emails: lib/meet/email.js (designed).
  Tests: tests/meet/signin_email.py (33).
- Own mail server (scripts/mailserver): setup.sh (Ubuntu 24.04/Oracle: Postfix, OpenDKIM selector "olex", Caddy HTTPS,
  firewall incl. Oracle's iptables, checks, prints DNS + Vercel values), relay.mjs (private sending API), bounce.mjs.
  Tests: tests/mail/relay.py (13). Needs Oracle to unblock port 25 and set PTR first.
- Tests made time-of-day independent (olex.py, schedule.py).
- 5.1: lib/mail/design.js = the shared email design (frame, p, esc; brand 'meet' or 'olexweb') used by every email;
  Meet's emails import it; Admin → Mail → Send test sends a designed "Olexweb Mail is working" email (testEmail).
