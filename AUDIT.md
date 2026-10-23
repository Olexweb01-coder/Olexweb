# YouTube API Services audit: prepared answers

Submit when a private upload has worked end to end. The form's wording changes from time to time: copy each answer
into the matching question and adjust if a question is phrased differently.
Form: YouTube API Services – Audit and Quota Extension Form (support.google.com/youtube/contact/yt_api_form).

## Before submitting

1. The privacy policy at https://olexweb.com/privacy#youtube and the terms at https://olexweb.com/terms#youtube are live.
2. Record a screen video (3–5 minutes, unlisted on YouTube or a shared Drive link) showing, in this order:
   - the Olexweb admin sign-in, then YouTube → Analytics → **Connect YouTube**: Google's account picker, the consent
     screen listing the three permissions, and returning connected;
   - the Analytics tab (channel numbers, labelled "Data from YouTube");
   - Ideas → a picked idea → Scripts: the script, editing the **title and description**, choosing **Private or
     Scheduled** publishing;
   - Send to the factory → the finished video → **Upload to YouTube** → the video in YouTube Studio;
   - **Disconnect**, with its message saying the stored YouTube data is deleted.

## Answers

**Organisation / developer:** Olexweb (sole proprietor: Olaitan Adebayo), Nigeria. Contact: info@olexweb.com.
Website: https://olexweb.com

**API client:** "Olexweb Admin", Google Cloud project "Olexweb Factory" (project number 121619580027).
OAuth redirect: https://olexweb.com/admin/api/youtube/callback

**What the API client does:** A private admin panel used only by the channel owner to run one YouTube channel
(@olexweb). It finds useful websites and tools to feature, writes and checks short video scripts, renders the videos,
and uploads approved videos to that channel. It shows the owner their own channel's analytics to judge what works.
It has no public users; only the channel owner can sign in (password plus two-step code).

**Who uses it:** One user: the owner of the @olexweb channel. Not offered to other channels or the public.

**APIs and scopes, each tied to a feature:**
- `youtube.readonly`: list the channel's own videos and their public statistics (Analytics tab, "Every upload"),
  and search YouTube to check whether a website has already been widely covered before making a video about it.
- `yt-analytics.readonly`: the channel's own daily views, watch time, average percentage viewed and subscribers
  (Analytics tab).
- `youtube.upload`: upload videos the owner has approved (Scripts tab → Upload to YouTube), as private or scheduled.

**Uploads:** The owner sets and can edit the title, description and privacy (Private, or Scheduled at a chosen time)
before upload. Videos are original: an animated host, a screen recording of the featured website, and synthesised
voice and music. Videos are marked not made for kids.

**Data storage and retention:**
- The Google refresh token, encrypted (AES-256-GCM) in the Olexweb database.
- Channel details and the channel's videos' public statistics: refreshed every day.
- Daily channel analytics: only the last 92 days, all re-fetched every day; older days are deleted.
- Per-video daily snapshots: 30 days, then deleted.
- Public view counts found when checking coverage of a website: 30 days, then deleted.
- Disconnect revokes the token at Google and deletes all stored YouTube data immediately. If access is revoked
  at Google instead, stored YouTube data is deleted within 30 days. Deletion requests by email: within 7 days.
- YouTube data is not sold, shared, combined with other data or used for advertising. Hosting: Vercel (app),
  Neon (database), both acting for Olexweb.

**Display of YouTube data:** Shown only to the owner in the admin, labelled as data from YouTube, with YouTube's
own metric names, unmodified.

**Privacy policy:** https://olexweb.com/privacy (section "YouTube and Google data": links the Google Privacy Policy
and explains revoking access at https://security.google.com/settings/security/permissions).
**Terms of service:** https://olexweb.com/terms (section "YouTube": users agree to the YouTube Terms of Service).

**Quota:** About one upload a day (videos.insert), about 1,000 units a day for searches and video look-ups,
and a few units for the daily channel sync. The default quota is enough; this audit is to lift the private-only
restriction on uploads from this project.
