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
