-- Olexweb admin database. Safe to run more than once (everything is "if not exists").
-- Secrets are never stored readable: passwords are Argon2id hashes, session/invite/link tokens are
-- SHA-256 fingerprints, and two-step secrets are AES-256-GCM encrypted with a key derived from AUTH_SECRET.

create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now());

-- ---------- people and security ----------
create table if not exists admin_users (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique check (email = lower(email)),
  name            text not null,
  role            text not null check (role in ('owner', 'editor', 'assistant')),
  password_hash   text,                                   -- null for the assistant, which never signs in
  totp_secret_enc text,
  totp_enabled    boolean not null default false,
  totp_last_step  bigint not null default 0,              -- a code can never be used twice
  recovery_hashes text[] not null default '{}',
  perms           jsonb not null default '{"publish": false, "reviews": false, "testimonials": false, "ventures": false}',
  disabled_at     timestamptz,
  created_at      timestamptz not null default now()
);
create table if not exists sessions (
  id_hash     text primary key,                           -- sha256 of the random token in the cookie
  user_id     uuid not null references admin_users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  expires_at  timestamptz not null,
  ip          text,
  user_agent  text
);
create index if not exists sessions_user on sessions(user_id);
create table if not exists pending_logins (                -- between password and two-step code
  id_hash     text primary key,
  user_id     uuid not null references admin_users(id) on delete cascade,
  expires_at  timestamptz not null,
  attempts    int not null default 0
);
create table if not exists login_throttle (                 -- per email and per IP
  key           text primary key,
  fails         int not null default 0,
  window_start  timestamptz not null default now(),
  locked_until  timestamptz
);
create table if not exists invites (
  token_hash  text primary key,
  email       text not null,
  perms       jsonb not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_by  uuid references admin_users(id)
);
create table if not exists audit_log (
  id       bigserial primary key,
  at       timestamptz not null default now(),
  user_id  uuid references admin_users(id) on delete set null,
  action   text not null,
  detail   jsonb not null default '{}',
  ip       text
);
create index if not exists audit_at on audit_log(at desc);

-- ---------- content ----------
create table if not exists projects (
  id          serial primary key,
  slug        text not null unique,
  name        text not null,
  kind        text not null,
  role        text not null default '',
  text        text not null default '',
  built       text[] not null default '{}',
  result      text not null default '',
  url         text not null default '',
  image       text not null default '',                   -- a /media/... key or a /v2/... path
  sort        int not null default 0,
  status      text not null default 'draft' check (status in ('live', 'hidden', 'draft', 'bin')),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references admin_users(id)
);
create table if not exists posts (
  id          serial primary key,
  slug        text not null unique,
  title       text not null,
  summary     text not null default '',
  body        jsonb not null default '[]',                -- [{type:'p'|'h', text}] blocks, never raw HTML
  published_on date,
  minutes     int not null default 1,
  status      text not null default 'draft' check (status in ('live', 'draft', 'waiting', 'bin')),
  seo         jsonb not null default '{}',                -- {keyword, title, description}
  sources     jsonb not null default '[]',                -- [{title, url}]
  evidence    jsonb not null default '[]',                -- real searches behind the topic (Assistant)
  author_id   uuid references admin_users(id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references admin_users(id)
);
create table if not exists ventures (
  id          serial primary key,
  slug        text not null unique,
  name        text not null,
  line        text not null default '',
  kind        text not null default '',
  text        jsonb not null default '[]',
  url         text not null default '',
  sort        int not null default 0,
  status      text not null default 'live' check (status in ('live', 'hidden', 'draft', 'bin')),
  updated_at  timestamptz not null default now()
);
create table if not exists testimonials (
  id          serial primary key,
  name        text not null,
  role        text not null default '',
  text        text not null,
  stars       int check (stars between 1 and 5),
  source      text not null check (source in ('typed', 'link')),
  status      text not null default 'waiting' check (status in ('waiting', 'published', 'rejected', 'bin')),
  consent     boolean not null default false,
  ip_hash     text,
  created_at  timestamptz not null default now(),
  decided_by  uuid references admin_users(id)
);
create table if not exists review_links (
  id          serial primary key,
  token_hash  text not null unique,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create table if not exists media (
  key         text primary key,                           -- random, unguessable
  mime        text not null,
  bytes       int not null,
  width       int,
  height      int,
  created_at  timestamptz not null default now(),
  created_by  uuid references admin_users(id)
);

-- ---------- Phase 2 (safe to run again) ----------
alter table projects drop constraint if exists projects_status_check;
alter table projects add constraint projects_status_check check (status in ('live', 'hidden', 'draft', 'waiting', 'bin'));
alter table ventures drop constraint if exists ventures_status_check;
alter table ventures add constraint ventures_status_check check (status in ('live', 'hidden', 'draft', 'waiting', 'bin'));
alter table projects add column if not exists binned_at timestamptz;
alter table posts add column if not exists binned_at timestamptz;
alter table ventures add column if not exists binned_at timestamptz;
alter table ventures add column if not exists image text not null default '';
update ventures set image = '/v2/sites/' || slug || '-full.webp' where image = '';

-- ---------- Phase 3 (safe to run again) ----------
alter table review_links add column if not exists token_enc text;          -- encrypted, so the owner can copy the link again
alter table invites add column if not exists name text;
alter table invites add column if not exists password_hash text;
alter table invites add column if not exists totp_secret_enc text;
alter table invites add column if not exists created_at timestamptz not null default now();
alter table testimonials add column if not exists decided_at timestamptz;
create index if not exists testimonials_ip on testimonials(ip_hash, created_at);

-- ---------- Phase 4 (safe to run again) ----------
alter table ventures add column if not exists summary text not null default '';   -- the short text on the Ventures cards
-- the live site's wording, filled in only where the original wording is still unchanged (your edits are never overwritten)
update ventures set line = $q$Where ideas too big for one website go.$q$ where slug = 'elvanex' and line = $q$A digital and technology venture.$q$;
update ventures set kind = $q$A digital and technology venture$q$ where slug = 'elvanex' and kind = '';
update ventures set summary = $q$A digital and technology venture that builds and runs products, platforms and experiments that outgrow a single site.$q$ where slug = 'elvanex' and summary = '';
update ventures set line = $q$The LinkedIn job search, rebuilt around the person searching.$q$ where slug = 'needar' and line = $q$A SaaS that makes the LinkedIn job search work for the person searching.$q$;
update ventures set kind = $q$A SaaS product$q$ where slug = 'needar' and kind = '';
update ventures set summary = $q$A problem easy to notice and hard to fix, taken the whole way: defined, designed, built and shipped as a service.$q$ where slug = 'needar' and summary = '';
update ventures set line = $q$An AI second brain.$q$ where slug = 'aviirel' and line = $q$An AI second brain.$q$;
update ventures set kind = $q$An AI product$q$ where slug = 'aviirel' and kind = '';
update ventures set summary = $q$Notes, ideas and knowledge in one place that thinks with you, instead of sitting in folders.$q$ where slug = 'aviirel' and summary = '';

-- ---------- Phase 5: the Assistant (safe to run again) ----------
create table if not exists assistant_settings (
  id          int primary key default 1 check (id = 1),               -- one row
  mode        text not null default 'approval' check (mode in ('approval', 'autopilot')),
  pace        int not null default 2 check (pace between 1 and 3),     -- articles a week
  topics      jsonb not null default '["web development", "AI for business", "immersive 3D websites", "website speed and SEO", "small business websites"]',
  socials     jsonb not null default '{"linkedin": "https://www.linkedin.com/in/olexweb", "x": "https://x.com/olexweb", "facebook": "https://www.facebook.com/share/17xWswJgGE/"}',
  model       text,                                                    -- picked automatically from the models your key can use
  last_run    timestamptz,
  updated_at  timestamptz not null default now()
);
insert into assistant_settings (id) values (1) on conflict do nothing;
create table if not exists assistant_messages (
  id          bigserial primary key,
  role        text not null check (role in ('you', 'assistant')),
  text        text not null,
  post_id     int references posts(id) on delete set null,
  created_at  timestamptz not null default now()
);
create table if not exists research_items (
  id          serial primary key,
  topic       text not null,
  why         text not null default '',
  searches    jsonb not null default '[]',      -- real searches (Google suggestions) behind the topic: the evidence
  sources     jsonb not null default '[]',      -- [{title, url, from}]
  found_on    date not null default current_date,
  used_by     int references posts(id) on delete set null
);
alter table posts add column if not exists origin text not null default 'person';            -- 'person' or 'assistant'
alter table posts add column if not exists claims jsonb not null default '[]';               -- sentences the assistant could not confirm
alter table posts add column if not exists auto_publish_at timestamptz;                      -- autopilot: publish if not reviewed by then
alter table posts add column if not exists checks jsonb not null default '{}';              -- results of the last automatic checks
insert into admin_users (email, name, role, perms, totp_enabled)
  values ('assistant@olexweb.local', 'Assistant', 'assistant', '{"publish": false, "reviews": false, "testimonials": false, "ventures": false}', false)
  on conflict (email) do nothing;                                                              -- never signs in: no password, no two-step secret

-- ---------- which AI wrote each assistant draft (safe to run again) ----------
alter table posts add column if not exists written_by text;

-- ---------- Blog engagement: likes, saves, shares, reading, analytics (safe to run again) ----------
-- Daily totals only. Readers are anonymous: a one-way fingerprint that changes every day, never an address or a cookie.
create table if not exists blog_daily (
  post_id  int not null references posts(id) on delete cascade,
  day      date not null,
  metric   text not null check (metric in ('view', 'reader', 'read', 'like', 'unlike', 'save', 'unsave', 'share', 'source')),
  key      text not null default '',          -- the app for shares, where readers came from for sources
  n        int not null default 0,
  primary key (post_id, day, metric, key)
);
create index if not exists blog_daily_day on blog_daily(day);
create table if not exists blog_seen (           -- today's anonymous readers (fingerprints kept 2 days)
  post_id int not null, day date not null, fp text not null, primary key (post_id, day, fp));
create table if not exists blog_likes (          -- one like per reader per article (fingerprint without the day)
  post_id int not null references posts(id) on delete cascade, fp text not null, at timestamptz not null default now(), primary key (post_id, fp));
create table if not exists blog_reading (        -- "reading now": a check-in every 30 seconds while the article is open
  post_id int not null, fp text not null, seen_at timestamptz not null default now(), primary key (post_id, fp));
create table if not exists blog_rate (           -- limits per anonymous reader, so scripts can't flood the counts
  fp text not null, window_start timestamptz not null, n int not null default 0, primary key (fp, window_start));
alter table posts add column if not exists likes int not null default 0;
alter table posts add column if not exists saves int not null default 0;
create table if not exists blog_settings (
  id int primary key default 1 check (id = 1),
  views_from int not null default 100, likes_from int not null default 10, reading_from int not null default 3,
  badges boolean not null default true, testimonials boolean not null default true, updated_at timestamptz not null default now());
insert into blog_settings (id) values (1) on conflict do nothing;

-- ---------- Assistant chat: conversations, and actions that wait for "Do it" (safe to run again) ----------
create table if not exists assistant_chats (
  id          serial primary key,
  title       text not null default 'New chat',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table assistant_messages add column if not exists chat_id int references assistant_chats(id) on delete cascade;
alter table assistant_messages add column if not exists action jsonb;                 -- what the assistant proposes to do
alter table assistant_messages add column if not exists action_state text check (action_state in ('proposed', 'running', 'done', 'cancelled', 'failed'));
-- messages from before chats existed go into one chat, once
do $$ begin
  if exists (select 1 from assistant_messages where chat_id is null) then
    with c as (insert into assistant_chats (title, created_at, updated_at)
               select 'Earlier messages', min(created_at), max(created_at) from assistant_messages where chat_id is null returning id)
    update assistant_messages set chat_id = (select id from c) where chat_id is null;
  end if;
end $$;
create index if not exists assistant_messages_chat on assistant_messages(chat_id, id);
create table if not exists assistant_usage (day date primary key, chat int not null default 0);   -- chat messages per day (protects the writer's allowance)

-- ---------- Olex AI: scheduling and notifications (safe to run again) ----------
create table if not exists scheduled_changes (
  id         serial primary key,
  run_at     timestamptz not null,
  kind       text not null check (kind in ('publish_post', 'set_mode', 'set_pace')),
  data       jsonb not null default '{}',
  label      text not null default '',
  created_at timestamptz not null default now(),
  done_at    timestamptz,
  result     text
);
create index if not exists scheduled_due on scheduled_changes(run_at) where done_at is null;
alter table assistant_settings add column if not exists paused_until timestamptz;
create table if not exists push_subscriptions (
  id         serial primary key,
  user_id    uuid not null references admin_users(id) on delete cascade,
  endpoint   text not null unique,
  keys       jsonb not null,
  device     text not null default '',
  created_at timestamptz not null default now(),
  last_ok    timestamptz,
  failures   int not null default 0
);
create table if not exists notify_prefs (
  user_id uuid primary key references admin_users(id) on delete cascade,
  prefs   jsonb not null default '{"published": true, "draft": true, "research": true, "run": true, "busy": true, "review": true}'
);

-- ---------- Chat speed, leads inbox, Search Console (safe to run again) ----------
alter table assistant_messages add column if not exists ms_first int;           -- how long the first words took
alter table assistant_messages add column if not exists ms_total int;           -- how long the whole reply took
alter table assistant_messages add column if not exists written_by text;        -- which AI answered
create table if not exists leads (
  id          serial primary key,
  created_at  timestamptz not null default now(),
  name        text not null,
  contact     text not null,                                                    -- WhatsApp number or email, as given
  need        text not null,
  business    text not null default '',
  budget      text not null default '',
  timeline    text not null default '',
  page        text not null default '',                                         -- the page they came from
  source      text not null default '',                                         -- Google, WhatsApp, LinkedIn, Direct…
  status      text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  notes       text not null default '',
  ip_hash     text not null default '',                                         -- for spam limits only (one-way)
  updated_at  timestamptz not null default now()
);
create index if not exists leads_recent on leads(created_at desc);
create table if not exists lead_clicks (                                        -- taps on WhatsApp buttons, by page (daily totals)
  day date not null, page text not null, label text not null default '', n int not null default 0,
  primary key (day, page, label)
);
create table if not exists gsc_queries (                                        -- Search Console: searches that found the site (last 28 days)
  fetched_on date not null, kind text not null check (kind in ('query', 'page')), key text not null,
  clicks int not null default 0, impressions int not null default 0, ctr real not null default 0, position real not null default 0,
  primary key (fetched_on, kind, key)
);
create table if not exists gsc_state (id int primary key default 1 check (id = 1), last_fetch timestamptz, last_error text, rows int not null default 0);
insert into gsc_state (id) values (1) on conflict do nothing;

-- ---------- Olex AI provider pool: who is resting, speed and record (safe to run again) ----------
create table if not exists ai_providers (id text primary key, rest_until timestamptz, last_error text, wins int not null default 0, fails int not null default 0,
  avg_first_ms int, last_ok timestamptz, last_model text, updated_at timestamptz not null default now());

-- ---------- Olex AI review windows (safe to run again) ----------
alter table assistant_settings add column if not exists review_hours int not null default 24;   -- 7, 12 or 24 hours before an Autopilot draft publishes
alter table posts add column if not exists reminded_at timestamptz;                              -- the "goes live soon" reminder was sent

-- ---------- Olex AI memory and feedback (safe to run again) ----------
create table if not exists ai_memory (id serial primary key, kind text not null default 'rule', text text not null, source text not null default 'chat',
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table assistant_messages add column if not exists rating smallint;
alter table assistant_messages add column if not exists feedback text;
alter table assistant_messages add column if not exists memory jsonb;
alter table ai_providers add column if not exists ups int not null default 0;
alter table ai_providers add column if not exists downs int not null default 0;

-- ---------- Olex AI documents (safe to run again) ----------
create table if not exists chat_docs (id serial primary key, chat_id int references assistant_chats(id) on delete cascade, name text not null, kind text not null,
  pages int, chars int not null, text text not null, note text, created_at timestamptz not null default now());
alter table assistant_messages add column if not exists docs jsonb;

-- ---------- YouTube: the channel connection and its numbers (safe to run again) ----------
-- The channel sign-in (a Google refresh token) is stored AES-256-GCM encrypted, like the two-step secrets.
create table if not exists yt_account (id int primary key default 1 check (id = 1), channel_id text, title text, handle text, thumb text,
  refresh_enc text, scopes text, connected_at timestamptz, subscribers int, views bigint, videos int, last_sync timestamptz, last_error text);
insert into yt_account (id) values (1) on conflict do nothing;
create table if not exists yt_oauth_states (state_hash text primary key, user_id uuid not null references admin_users(id) on delete cascade,
  verifier_enc text not null, expires_at timestamptz not null);                    -- one-time, 10 minutes: proves a sign-in to Google was started here
create table if not exists yt_videos (video_id text primary key, title text not null, published_at timestamptz, duration_s int, is_short boolean not null default false,
  thumb text, privacy text, views bigint not null default 0, likes int not null default 0, comments int not null default 0,
  minutes real, avg_view_pct real, shares int, subs_gained int, updated_at timestamptz not null default now());
create table if not exists yt_daily (day date primary key, views int not null default 0, minutes real not null default 0, avg_view_pct real,
  subs_gained int not null default 0, subs_lost int not null default 0, likes int not null default 0, shares int not null default 0);  -- the channel, per day
create table if not exists yt_snap (day date not null, video_id text not null, views bigint not null default 0, likes int not null default 0, comments int not null default 0,
  primary key (day, video_id));                                                     -- each video's totals once a day: how fast a new video grows

-- ---------- YouTube ideas: goldmine websites, tools and updates, checked and scored (safe to run again) ----------
create table if not exists yt_ideas (id serial primary key, key text not null unique, name text not null, url text not null, source text not null, signal text,
  kind text, category text, what text, hook text, why text, risks text, scores jsonb, coverage jsonb, score int not null default 0, page_title text,
  status text not null default 'new' check (status in ('new', 'picked', 'skipped', 'passed', 'made')),   -- passed = judged and turned down, kept so it isn't judged again
  created_at timestamptz not null default now(), decided_at timestamptz);
create index if not exists yt_ideas_status on yt_ideas(status, score desc);
create table if not exists yt_idea_runs (id int primary key default 1 check (id = 1), last_run timestamptz, last_report jsonb, running_until timestamptz);
insert into yt_idea_runs (id) values (1) on conflict do nothing;

-- ---------- YouTube scripts: a picked idea becomes the factory's scene-by-scene script (safe to run again) ----------
create table if not exists yt_settings (id int primary key default 1 check (id = 1), series text not null default 'Secret websites you should know',
  next_part int not null default 9, mention_every int not null default 4, made int not null default 0, voice text not null default 'am_michael');
insert into yt_settings (id) values (1) on conflict do nothing;
create table if not exists yt_scripts (id serial primary key, idea_id int unique references yt_ideas(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'needs_review', 'approved', 'rendering', 'rendered', 'uploaded', 'failed')),
  script jsonb not null, package jsonb not null, claims jsonb not null default '[]', checks jsonb not null default '[]', seconds real,
  page text,                                       -- the site's own words when the script was written: what every claim is checked against
  writer text, mention boolean not null default false, part int,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), approved_at timestamptz);
alter table yt_ideas add column if not exists script_tried_at timestamptz;

-- ---------- live progress for long YouTube jobs, and how long each stage took last time (safe to run again) ----------
create table if not exists yt_jobs (kind text primary key, started_at timestamptz, updated_at timestamptz, finished_at timestamptz, state jsonb, history jsonb not null default '{}');

-- ---------- the render factory (safe to run again) ----------
alter table yt_scripts add column if not exists video jsonb;                 -- while rendering: {pieces: {n: size}}; when done: {pieces, bytes, seconds, width, height}
alter table yt_scripts add column if not exists render_error text;
alter table yt_scripts add column if not exists render_started_at timestamptz;

-- ---------- publishing to YouTube (safe to run again) ----------
alter table yt_settings add column if not exists publish_mode text not null default 'private';   -- private until Google's audit; then scheduled
alter table yt_settings add column if not exists publish_time text not null default '18:00';    -- Lagos time
alter table yt_scripts add column if not exists upload jsonb;                                    -- the resumable session, so an interrupted upload carries on
alter table yt_scripts add column if not exists yt_video_id text;
alter table yt_scripts add column if not exists uploaded_at timestamptz;

-- ---------- factory resilience (safe to run again) ----------
alter table yt_scripts add column if not exists render_detail text;       -- the admin-side reason when something fails (shown only in the admin)
create table if not exists yt_pieces (script_id int not null references yt_scripts(id) on delete cascade, n int not null, data bytea not null,
  saved_at timestamptz not null default now(), primary key (script_id, n));  -- backup for video pieces when the bucket refuses; emptied after upload

-- ---------- YouTube data rules (safe to run again) ----------
alter table yt_account add column if not exists revoked_at timestamptz;   -- when Google stopped accepting the sign-in: its data is deleted within 30 days

-- ---------- series format (safe to run again) ----------
alter table yt_settings add column if not exists series_in_title boolean not null default true;   -- "Secret Websites You Should Know (Part 10) | …"
alter table yt_settings add column if not exists spoken_intro boolean not null default true;      -- the voice opens with "…, part ten."

-- ---------- long videos, twice a week (safe to run again) ----------
alter table yt_scripts add column if not exists kind text not null default 'short';     -- short | long
alter table yt_scripts add column if not exists items jsonb;                            -- long: the ideas it covers
alter table yt_settings add column if not exists long_days text not null default 'tue,fri';
alter table yt_settings add column if not exists long_count int not null default 6;
alter table yt_settings add column if not exists long_volume int not null default 1;
create table if not exists yt_long_items (script_id int not null references yt_scripts(id) on delete cascade, idea_id int not null references yt_ideas(id) on delete cascade,
  primary key (script_id, idea_id));

-- ---------- short links (olexweb.com/me → WhatsApp) and the free audio course (olexweb.com/aoc) (safe to run again) ----------
create table if not exists site_links (slug text primary key, phone text not null, message text not null default '', clicks int not null default 0, updated_at timestamptz not null default now());
insert into site_links (slug, phone, message) values ('me', '2347011726321', 'Hi Olex, I want Anatomy of Creation 🙌') on conflict do nothing;
create table if not exists site_link_clicks (slug text not null, day date not null, n int not null default 0, primary key (slug, day));
create table if not exists aoc_settings (id int primary key default 1 check (id = 1), goal int not null default 300, content jsonb not null default '{}');
insert into aoc_settings (id) values (1) on conflict do nothing;
create table if not exists aoc_listeners (id serial primary key, token text not null unique, name text not null, ip_hash text, progress jsonb not null default '{}',
  feedback text, feedback_at timestamptz, created_at timestamptz not null default now(), last_seen timestamptz not null default now());
alter table aoc_settings add column if not exists close_when_full boolean not null default true;   -- the flyer says "300 slots only · then it closes"
-- the new flyer (100 slots, never closes by itself; "few spaces left" from 60; bonus spots after 100; closed only by hand)
alter table aoc_settings add column if not exists accepting boolean not null default true;
alter table aoc_settings add column if not exists flyer_version int not null default 0;
update aoc_settings set goal = 100, close_when_full = false, accepting = true, content = '{}', flyer_version = 3 where id = 1 and flyer_version < 3;   -- once only

-- ---------- the posting queue: one video a day (safe to run again) ----------
alter table yt_scripts add column if not exists queue_pos int;      -- null = not queued; lower goes first
create index if not exists yt_scripts_queue on yt_scripts (queue_pos) where queue_pos is not null;
alter table yt_settings add column if not exists publish_time2 text;   -- a second daily slot ("2 videos a day"); null = one a day
-- best posting times: a weekly SUMMARY of the niche (no competitor videos kept) + where his viewers are; status checks
create table if not exists yt_time_research (id int primary key default 1 check (id = 1), researched_at timestamptz, videos int not null default 0,
  hours jsonb not null default '{}'::jsonb, countries jsonb not null default '[]'::jsonb, terms text);
alter table yt_settings add column if not exists status_checked_at timestamptz;

-- ---------- Pages & links: pages from templates at any address, sign-ups, short links to any URL ----------
create table if not exists pages (id serial primary key, slug text not null unique, type text not null check (type in ('webinar', 'event', 'audio')),
  status text not null default 'draft' check (status in ('draft', 'live')), content jsonb not null default '{}'::jsonb, goal int not null default 100,
  accepting boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz);
create table if not exists page_signups (id serial primary key, page_id int not null references pages(id) on delete cascade, token text not null unique,
  name text not null, ip_hash text, progress jsonb not null default '{}'::jsonb, feedback text, feedback_at timestamptz,
  created_at timestamptz not null default now(), last_seen timestamptz not null default now());
create index if not exists page_signups_page on page_signups (page_id, created_at);
alter table site_links add column if not exists url text;            -- a short link to any website (phone stays for WhatsApp links)
alter table site_links alter column phone drop not null;
create table if not exists page_files (id text primary key, name text not null, mime text not null, bytes bigint not null, pieces int not null,
  piece_size int not null, got int[] not null default '{}', ready boolean not null default false, created_at timestamptz not null default now());

-- ---------- The Olexweb Directory: a page for every useful website the research engine finds (olexweb.com/tools/<slug>) ----------
create table if not exists dir_entries (id serial primary key, slug text not null unique, idea_id int unique references yt_ideas(id) on delete set null,
  name text not null, url text not null, category text, status text not null default 'draft' check (status in ('draft', 'live', 'blocked')),
  content jsonb not null default '{}'::jsonb, quality jsonb not null default '{}'::jsonb, views int not null default 0, leads int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz);
create index if not exists dir_entries_live on dir_entries (status, published_at desc);
create table if not exists dir_daily (slug text not null, day date not null, views int not null default 0, leads int not null default 0, primary key (slug, day));
create table if not exists dir_settings (id int primary key default 1 check (id = 1), per_day int not null default 12, auto_publish boolean not null default true, last_ping jsonb);
insert into dir_settings (id) values (1) on conflict do nothing;
-- blog pace: up to 21 articles a week (was 1–3)
alter table assistant_settings drop constraint if exists assistant_settings_pace_check;
alter table assistant_settings add constraint assistant_settings_pace_check check (pace between 1 and 21);
alter table assistant_settings add column if not exists research_at timestamptz;   -- last extra research for high paces
-- YouTube's own Approval/Autopilot switch (separate from the blog's); starts as a copy of the shared setting, once
alter table yt_settings add column if not exists yt_mode text check (yt_mode in ('approval', 'autopilot'));
update yt_settings set yt_mode = coalesce((select mode from assistant_settings where id = 1), 'approval') where id = 1 and yt_mode is null;
alter table dir_entries add column if not exists yt_linked_at timestamptz;   -- "guide link added to the Short" (older Shorts, done by hand)

-- ---------- Facebook Page Reels (Meta's official API; own Page; Instagram later) ----------
create table if not exists meta_oauth_states (state_hash text primary key, user_id text, created_at timestamptz not null default now());
create table if not exists meta_pages (page_id text primary key, name text not null, token_enc text not null, tasks jsonb not null default '[]'::jsonb, selected boolean not null default false, added_at timestamptz not null default now());
create table if not exists meta_settings (id int primary key default 1 check (id = 1), enabled boolean not null default false, per_day int not null default 1 check (per_day between 1 and 3),
  paused_at timestamptz, paused_reason text, connected_at timestamptz, ig_enabled boolean not null default false);
insert into meta_settings (id) values (1) on conflict do nothing;
alter table yt_scripts add column if not exists fb jsonb;     -- {status: posted|failed|skipped, video_id, at, error, tries}
alter table meta_oauth_states alter column user_id type text using user_id::text;   -- admin user ids are text (uuid)
create table if not exists meta_posts (id serial primary key, script_id int, video_id text, at timestamptz not null default now());   -- every Reel posted: the daily limit counts these
-- Automation (Oct 2026): Facebook has its own posting times and queue, separate from YouTube's
alter table meta_settings add column if not exists times text;                    -- '13:00,20:00' (Lagos); empty = defaults for per_day
alter table meta_posts add column if not exists slot text;                        -- 'YYYY-MM-DD HH:MM' (Lagos) the Reel filled
-- Meetings (Nov 2026): video meetings at olexweb.com/meet/<code>, hosted by the owner, joined by anyone with the link (LiveKit)
create table if not exists meetings (id serial primary key, code text not null unique, title text not null, speakers text not null default 'everyone' check (speakers in ('everyone', 'invited')),
  host_id text, created_at timestamptz not null default now(), started_at timestamptz, ended_at timestamptz, last_join_at timestamptz, joins int not null default 0);
create index if not exists meetings_open on meetings (created_at desc) where ended_at is null;
-- Meetings install 3 (Nov 2026): AI notes from the host's recording (summary, decisions, action items) and the transcript
alter table meetings add column if not exists notes jsonb;
alter table meetings add column if not exists transcript text;
alter table meetings add column if not exists notes_at timestamptz;
alter table meetings add column if not exists notes_by text;
-- Automation install 2 (Nov 2026): the Library. Which channels each idea's Short goes to (ticks), and "Make it next".
alter table yt_ideas add column if not exists channels jsonb not null default '{"youtube": true, "facebook": true}'::jsonb;
alter table yt_ideas add column if not exists first boolean not null default false;   -- Make it next: ahead in scripts, factory and both queues
-- Meetings, scheduling (Nov 2026): a start time, length, reminders (minutes before; smart defaults unless you set your own)
alter table meetings add column if not exists starts_at timestamptz;
alter table meetings add column if not exists minutes int not null default 60;
alter table meetings add column if not exists reminders jsonb not null default '[]';
alter table meetings add column if not exists reminders_auto boolean not null default true;   -- smart defaults: recalculated when rescheduled
alter table meetings add column if not exists reminded jsonb not null default '[]';           -- reminders already sent (minutes before)
alter table meetings add column if not exists start_notified_at timestamptz;
create index if not exists meetings_upcoming on meetings (starts_at) where ended_at is null and starts_at is not null;

-- Olexweb Mail (Nov 2026): Olaitan's own email platform for the whole site. Pipes (own server, Resend, Mailjet) are
-- tried in order; each has daily and monthly limits and rests after failures. lib/mail/index.js.
create table if not exists mail_messages (id bigserial primary key, created_at timestamptz not null default now(), to_email text not null, subject text not null,
  kind text not null default 'system', source text not null default 'site', status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'suppressed', 'skipped', 'bounced', 'complained')),
  pipe text, provider_id text, tries jsonb not null default '[]', error text, sent_at timestamptz);
create index if not exists mail_messages_recent on mail_messages (created_at desc);
create index if not exists mail_messages_to on mail_messages (lower(to_email), created_at desc);
create index if not exists mail_messages_provider on mail_messages (pipe, provider_id) where provider_id is not null;
-- addresses never sent to again (bounced, complained, or added by hand); kind 'code' emails respect it too
create table if not exists mail_suppressions (email text primary key, reason text not null, note text, created_at timestamptz not null default now());
-- each pipe's use per day (months are summed from these), and when it may be tried again after failures
create table if not exists mail_pipe_days (pipe text not null, day date not null, sent int not null default 0, primary key (pipe, day));
create table if not exists mail_pipes (pipe text primary key, rest_until timestamptz, fails int not null default 0, last_error text, last_ok timestamptz, last_fail timestamptz);

-- Olex Sales (Nov 2026): Olaitan's own client-finding agent (ideas from the open-source Harvey, MIT). Finds UK/US
-- businesses, reads their websites for honest signals, finds published emails, drafts short emails with the free AI pool,
-- sends at most 20 a day from a Gmail account after Olaitan approves, handles replies, books calls. lib/sales.
create table if not exists sales_settings (id int primary key default 1 check (id = 1), enabled boolean not null default false,
  require_approval boolean not null default true, daily_cap int not null default 20, start_date date, sender_name text not null default 'Olaitan Adebayo',
  postal_address text, opt_out_line text not null default 'Not interested? Reply "no thanks" and I won''t email again.',
  call_hours jsonb not null default '{"days":[1,2,3,4,5],"from":"14:00","to":"18:00"}', targets jsonb not null default '{}', updated_at timestamptz not null default now());
insert into sales_settings (id) values (1) on conflict (id) do nothing;
create table if not exists sales_companies (id bigserial primary key, created_at timestamptz not null default now(), name text not null, website text, domain text,
  country text not null check (country in ('GB', 'US')), city text, region text, phone text, category text, source text not null, source_ref text,
  ch_number text, company_type text, status text not null default 'new', score int, profiled_at timestamptz, profile_error text, notes text,
  unique (country, source, source_ref));
create unique index if not exists sales_companies_domain on sales_companies (lower(domain)) where domain is not null;
create index if not exists sales_companies_status on sales_companies (status, created_at);
-- one row per thing observed about a company (no website, slow on mobile, no booking…), with its evidence
create table if not exists sales_signals (company_id bigint not null references sales_companies(id) on delete cascade, code text not null,
  value_num numeric, value_text text, evidence text, observed_at timestamptz not null default now(), primary key (company_id, code));
create table if not exists sales_contacts (id bigserial primary key, company_id bigint not null references sales_companies(id) on delete cascade,
  name text, role text, email text not null, email_status text not null default 'unchecked', source_url text, opted_out_at timestamptz, created_at timestamptz not null default now());
create unique index if not exists sales_contacts_email on sales_contacts (lower(email));
create table if not exists sales_outbox (id bigserial primary key, created_at timestamptz not null default now(), company_id bigint not null references sales_companies(id) on delete cascade,
  contact_id bigint not null references sales_contacts(id) on delete cascade, step int not null default 1, subject text not null, body text not null,
  status text not null default 'waiting' check (status in ('waiting', 'approved', 'sent', 'rejected', 'held', 'failed', 'cancelled')),
  held_reason text, send_after timestamptz, sent_at timestamptz, message_id text, error text);
create index if not exists sales_outbox_due on sales_outbox (status, send_after);
create table if not exists sales_dnc (entry text primary key, reason text, created_at timestamptz not null default now());   -- never contact (an address or a whole domain)
-- Olex Sales part 2: replies, bounces, follow-ups, booking
alter table sales_settings add column if not exists imap_uid bigint not null default 0;          -- the last inbox message read
alter table sales_settings add column if not exists paused_reason text;                          -- set when too many emails bounce
alter table sales_outbox add column if not exists in_reply_to text;                              -- keeps follow-ups and answers in the same thread
alter table sales_companies add column if not exists next_touch_after timestamptz;               -- an out-of-office reply pushes follow-ups back
create table if not exists sales_replies (id bigserial primary key, received_at timestamptz not null default now(), company_id bigint references sales_companies(id) on delete cascade,
  contact_id bigint references sales_contacts(id) on delete set null, outbox_id bigint references sales_outbox(id) on delete set null, from_email text not null, subject text,
  body text, intent text not null, summary text, message_id text, handled boolean not null default false);
create index if not exists sales_replies_recent on sales_replies (received_at desc);
create table if not exists sales_bookings (id bigserial primary key, created_at timestamptz not null default now(), meeting_code text not null, starts_at timestamptz not null,
  name text not null, email text not null, company text, note text, company_id bigint references sales_companies(id) on delete set null, ip_hash text);
-- Install 9: hands-off automation (no human gate)
alter table yt_scripts add column if not exists hold_until timestamptz;    -- Autopilot: a script with small problems waits until then, then goes ahead
alter table yt_scripts add column if not exists auto_fixes jsonb;          -- what Autopilot mended itself, in plain words
alter table yt_scripts add column if not exists render_tries int not null default 0;   -- factory attempts; a failed video is made again up to 3 times
alter table yt_ideas add column if not exists rewrites int not null default 0;          -- scripts thrown away for a critical problem; after 2 the idea is set aside
-- Install 10: the posting agent (one per platform: how many a day, 1–3, and when, from real results)
alter table yt_settings add column if not exists publish_time3 text;          -- a third daily slot (the agent may go up to 3 a day)
create table if not exists post_agent (platform text primary key check (platform in ('youtube', 'facebook')), enabled boolean not null default true,
  per_day int not null default 1 check (per_day between 1 and 3), reviewed_at timestamptz, reviews int not null default 0, note text,
  history jsonb not null default '[]'::jsonb, base_per_day int);
insert into post_agent (platform) values ('youtube'), ('facebook') on conflict do nothing;
-- Install 11: one frequent run at a time, and when it last ran (shown on the Today tab)
create table if not exists run_locks (name text primary key, until timestamptz not null, started_at timestamptz, finished_at timestamptz,
  last_ok boolean, last_report jsonb);
-- Install 12: story Shorts (the sketch style, his acted voice). New Shorts are classic until you switch them to story.
alter table yt_settings add column if not exists short_style text not null default 'classic';
-- Install 13: the long story (kind 'saga': his whole day in chapters, the main video), Shorts cut from it, the five formats
-- taking turns, Facebook's own version of each story (a question instead of the loop), and Reel views for the posting agent.
alter table yt_settings add column if not exists format_turn int not null default 0;     -- whose turn among the Short formats
alter table yt_settings add column if not exists saga_turn int not null default 0;       -- whose turn among the long-story formats
alter table yt_settings add column if not exists saga_time text not null default '16:00'; -- the long story's own daily time (Lagos), apart from the Shorts
alter table yt_scripts add column if not exists parent_id int references yt_scripts(id) on delete set null;   -- a Short cut from a long story
create index if not exists yt_scripts_parent on yt_scripts (parent_id) where parent_id is not null;
alter table meta_posts add column if not exists views int;                     -- Reel plays, read 3 days after posting (when Meta allows it)
alter table meta_posts add column if not exists views_at timestamptz;
alter table meta_settings add column if not exists insights text;              -- 'ok' | 'denied': whether Meta lets us read Reel views
alter table meta_settings add column if not exists insights_at timestamptz;    -- when that was last tried
-- Install 16: the Directory becomes a daily goldmine: tools, tech updates, how-tos and safety alerts, about 5 a day at set
-- times, every fact checked against its source; told to Google the same day; the day's best shared on Facebook.
alter table dir_entries add column if not exists kind text not null default 'tool';        -- tool | update | guide | alert
alter table dir_entries add column if not exists source_name text;                          -- the article it's based on (not tools)
alter table dir_entries add column if not exists find_id int;                               -- dir_finds row it came from (not tools)
alter table dir_entries add column if not exists slot text;                                 -- 'YYYY-MM-DD HH:MM' it went live in (Lagos)
alter table dir_entries add column if not exists score int;                                 -- how useful the find was judged (0–100)
alter table dir_entries drop constraint if exists dir_entries_status_check;
alter table dir_entries add constraint dir_entries_status_check check (status in ('draft', 'ready', 'live', 'blocked'));
create unique index if not exists dir_entries_find on dir_entries (find_id) where find_id is not null;
create index if not exists dir_entries_kind on dir_entries (kind, status, published_at desc);
create table if not exists dir_finds (id serial primary key, key text not null unique, kind text not null, title text not null, url text not null,
  source text not null, summary text, body text, published_at timestamptz, score int, why text, status text not null default 'new',   -- new | used | skipped
  created_at timestamptz not null default now());
create index if not exists dir_finds_new on dir_finds (status, kind, score desc);
alter table dir_settings add column if not exists slots text not null default '08:00,11:00,14:00,17:00,20:00';   -- when posts go live (Lagos)
alter table dir_settings add column if not exists kinds text not null default 'tool,update,guide,alert';         -- which kinds are on
alter table dir_settings add column if not exists fb_share boolean not null default true;   -- the day's best post on the Facebook Page
alter table dir_settings add column if not exists fb_last date;                              -- the day it last shared (Lagos)
alter table dir_settings add column if not exists gathered_at timestamptz;                   -- news sources last read
alter table dir_settings add column if not exists google jsonb;                              -- last "tell Google" result
alter table dir_settings alter column per_day set default 5;
update dir_settings set per_day = 5 where per_day = 12;                                      -- the old default: now about 5 a day
-- Install 17: wider stories. The Directory's tech updates, how-tos and safety alerts become chapters of the long story too.
alter table dir_entries add column if not exists story_id int;   -- the long story (yt_scripts.id) that used this post
-- Install 18: the sales agent, phase 1. France joins the UK and US (Germany and Austria never: their law needs consent even
-- for business emails); the agent's read of each business (price level, offer, price, angle, language); official documents.
alter table sales_companies drop constraint if exists sales_companies_country_check;
alter table sales_companies add constraint sales_companies_country_check check (country in ('GB', 'US', 'FR'));
alter table sales_companies add column if not exists plan jsonb;           -- the agent's read (tier.js planCompany)
alter table sales_companies add column if not exists tier text;            -- starter | growth | premium (only ever goes up)
alter table sales_settings add column if not exists countries text not null default 'GB,US,FR';   -- where it looks and emails
alter table sales_settings add column if not exists bank jsonb;            -- printed on invoices (payment straight to the bank)
create table if not exists sales_docs (id bigserial primary key, created_at timestamptz not null default now(), kind text not null check (kind in ('ratecard', 'invoice')),
  number text not null, token text not null unique, company_id bigint references sales_companies(id) on delete set null, data jsonb not null,
  status text not null default 'issued', viewed_at timestamptz);
