# YouTube automation tests (152 checks)

These run the real admin (`npm run build`, then `next start`) against stand-ins for Google (OAuth, YouTube Data,
Analytics, uploads), Gemini, GitHub and the storage bucket, with a local Postgres. They were written in Claude's
Linux sandbox; the scripts expect these paths (recreate them in a new sandbox):

- `/home/claude/Olexweb` — this project (built with `npm run build`)
- `/home/claude/olexweb-factory` — the factory repo, with `npm install` done and the Kokoro model in `models/`
- `/home/claude/yt-test` — this folder, with `node_modules` linked to the project's (`ln -s ../Olexweb/node_modules`)
- Postgres 16 with user `olex` / password `olex`, database `olexweb`, schema applied from `db/schema.sql`
- Python: `playwright`, `kokoro-onnx==0.6.1`, `soundfile`, `numpy`, `scipy`; ffmpeg

Suites: `run.sh` connect + analytics (37) · `run5.sh` ideas (31), scripts (25), speed + progress (17) ·
`frun.sh phaseA.sh` / `phaseB.sh` / `phaseC.sh` the factory, real capture and render (28) · `frun.sh phaseD.sh` uploads (14).
Phase B renders a real video (about 3 minutes on one CPU). The sandbox stops background processes between steps,
so each runner starts and stops everything itself.
