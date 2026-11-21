# Olexweb Meet: our own free video server

Meetings use our own server when it's working, and LiveKit Cloud (the backup) when it isn't. This happens by itself.

1. **Oracle:** create the Always Free computer (Ubuntu 22.04, Ampere A1, 4 OCPUs, 24 GB) and note its Public IP.
2. **Open the ports:** in Oracle, go to Networking → Virtual cloud networks → your network → Security Lists → Default → Add Ingress Rules. Use Source `0.0.0.0/0` for each:
   - TCP 80, 443, 7881, 5349
   - UDP 3478
   - UDP 50000-60000
3. **Web addresses:** where olexweb.com's DNS is managed, add two **A** records that point to the Public IP:
   - `meet-rtc`
   - `turn-rtc`
4. **Install:** connect to the computer (Oracle's Cloud Shell or SSH), create `install.sh` with this file's contents, then run:
   `sudo bash install.sh meet-rtc.olexweb.com turn-rtc.olexweb.com YOUR_EMAIL`
5. **Vercel:** add the three lines it prints (`LIVEKIT_SELF_URL`, `LIVEKIT_SELF_API_KEY`, `LIVEKIT_SELF_API_SECRET`), then Redeploy. Admin → Meetings → Usage then shows **Free server: Working**.

Keep the LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET you already have. They are the backup.

**Keeping the computer:** Oracle can take back Always Free computers that sit idle on free-only accounts. Upgrading the account to "Pay As You Go" stops that. Always Free items stay free.
