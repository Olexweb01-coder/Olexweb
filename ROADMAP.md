# Olexweb roadmap

Paste this file into a new chat with Claude to continue exactly where we left off.

Working rules (from HANDOFF.md): every change is built and tested before handover; Olaitan's machine is
Windows (PowerShell in VS Code); show a preview before download; be honest about limits. Changes arrive as a zip
of only the changed files, extracted over the project, then `npm run build`, `npm run admin:setup` (database), push.

## Phase 1: faceless YouTube automation (in progress)

Channel: youtube.com/@olexweb (owned by adebayoolaitan204@gmail.com). Niche: goldmine websites, tools, ideas and
tech that people thank you for. Creativity, productivity, learning, ideas, fun, everyday life, useful AI and tech;
for curious people of every kind, not only developers. Fully autopilot, steady pace (about one Short a day plus a
weekly long video), never mass posting.

Factory style (approved): stickman host drawn in code (green glasses), word-by-word captions in green, real screen
recordings of the site, infographics, synthesised sound effects, music from ACE-Step (open source, commercial use
allowed; never MusicGen or free Suno/Udio, which forbid commercial use). Prototype: olexweb-factory-prototype.zip.

Setup done (Phase 0): Google Cloud project "Olexweb Factory" (olexweb01@gmail.com, no organization), YouTube Data API
v3 and YouTube Analytics API enabled, consent screen External + In production, OAuth client "Olexweb Admin" with
redirect https://olexweb.com/admin/api/youtube/callback. Vercel: YT_CLIENT_ID, YT_CLIENT_SECRET, FACTORY_GH_TOKEN
(fine-grained, Actions read/write on olexweb-factory only, yearly expiry). GitHub repo Olexweb01-coder/olexweb-factory
(public, for unlimited free Actions minutes).

- [x] Part 1: Connect YouTube + Analytics (admin → YouTube). Live and connected.
- [x] Part 2: Ideas: curated sources (Recomendo, Cool Tools, Kottke, Waxy, Open Culture, Free Tech 4 Teachers,
      Sidebar), plus Show HN, Hacker News, GitHub and evergreen picks; every site opened live; scored out of 100
      (value 30, wow 20, reach 15, fresh on YouTube 15, free 10, easy to show 10); unsafe or thin ideas turned down;
      at most 2 of a kind per search; daily, with Find ideas now. Sources, sites (12 at a time), judging and YouTube
      checks run in parallel; a live progress panel shows each stage, counts, countdown (learned from the last run),
      server download speed and a heartbeat (also for script writing).
- [x] Part 3: Script writer (admin → YouTube → Scripts): a picked idea becomes the factory's scene list (hook, demo
      with what to film, infographic, talk, url, cta; stickman pose per scene), plus 3 titles, description, hashtags,
      and an olexweb.com mention in every 4th description. Checked in code: 20–35 s, 6–10 scenes, hook ≤ 12 words,
      2+ scenes of the real site, no years, every number and claim backed by a quote from the site's page (fetched
      fresh). One automatic repair pass; still failing → "Needs your eye" (Edit, or Approve anyway with confirmation).
      Autopilot approves passing scripts itself; the frequent run writes one picked idea's script at a time.
- [x] Part 4: Render factory (repo olexweb-factory, GitHub Actions workflow render.yml). Approved script → "Send to
      the factory" (Autopilot sends the next one itself, one at a time) → GitHub runs: film the real site (wheel
      scrolling, pop-ups cleared) → Kokoro voice → synthesised music (key/tempo vary by part) → Remotion render →
      MP4 sent back in 4 MiB signed pieces, stored in the private bucket, playable in the admin with seeking.
      Every call is signed with FACTORY_SECRET (Vercel + factory GitHub secret); nothing secret in the public run
      inputs. Live progress for every stage. A silent run is marked stopped after 25 minutes.
- [ ] Part 4b: ACE-Step music library (generated on GitHub's larger machines; first run there is the test).
- [ ] Part 5: Upload + schedule (private until the YouTube API audit passes; submit the audit right after the first
      private upload works; add a YouTube data section to olexweb.com/privacy first).
- [ ] Part 6: Learning loop: 24 h and 72 h results feed back into topic, hook and posting-time choices. Shorts
      cut-downs and the weekly long video (needed for monetisation: from 1 Feb 2027 new channels need 8,000 watch
      hours in 12 months, or 20 million Shorts views in 90 days).

## Phase 2: Olex AI upgrade (after Phase 1)

- Voice chat rebuilt: professional, accurate replies with deeper thinking while staying fast (better speech
  recognition and voice, and routing quick questions to fast models, harder ones to stronger reasoning).
- Much wider abilities: create and edit images, search and read websites, schedules, alarms and reminders that
  notify the phone, meetings with people (to be scoped: booking and invites first; joining calls is a bigger piece),
  and more, listed and ranked together when this phase starts.
