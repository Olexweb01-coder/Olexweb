-- Olexweb Meet's tables. Applied by `npm run admin:setup` to Meet's own database (MEET_DATABASE_URL) when it's set, so
-- busy public meetings can never use up the admin database's limits; without it, to the main database. Safe to re-run.

-- meetings (the same table the admin has used since Nov 2026; carried over to Meet's database on first setup)
create table if not exists meetings (id serial primary key, code text not null unique, title text not null, speakers text not null default 'everyone' check (speakers in ('everyone', 'invited')),
  host_id text, created_at timestamptz not null default now(), started_at timestamptz, ended_at timestamptz, last_join_at timestamptz, joins int not null default 0);
alter table meetings add column if not exists notes jsonb;
alter table meetings add column if not exists transcript text;
alter table meetings add column if not exists notes_at timestamptz;
alter table meetings add column if not exists notes_by text;
alter table meetings add column if not exists starts_at timestamptz;
alter table meetings add column if not exists minutes int not null default 60;
alter table meetings add column if not exists reminders jsonb not null default '[]';
alter table meetings add column if not exists reminders_auto boolean not null default true;
alter table meetings add column if not exists reminded jsonb not null default '[]';
alter table meetings add column if not exists start_notified_at timestamptz;
create index if not exists meetings_open on meetings (created_at desc) where ended_at is null;
create index if not exists meetings_upcoming on meetings (starts_at) where ended_at is null and starts_at is not null;

-- people who sign in to Meet to create or schedule meetings (guests who only join never get an account)
create table if not exists meet_users (id serial primary key, email text, email_verified boolean not null default false, name text not null default '', picture text,
  role text not null default 'user' check (role in ('user', 'owner')), created_at timestamptz not null default now(), last_seen timestamptz not null default now(), banned_at timestamptz, banned_reason text);
create index if not exists meet_users_email on meet_users (lower(email)) where email is not null;
-- each sign-in method a person used (Google, Microsoft, GitHub, Facebook), by that provider's own id for them
create table if not exists meet_identities (provider text not null, subject text not null, user_id int not null references meet_users (id) on delete cascade,
  email text, created_at timestamptz not null default now(), primary key (provider, subject));
-- signed-in browsers: only a hash of the cookie's secret is stored
create table if not exists meet_sessions (id_hash text primary key, user_id int not null references meet_users (id) on delete cascade,
  created_at timestamptz not null default now(), expires_at timestamptz not null, last_seen timestamptz not null default now());
create index if not exists meet_sessions_user on meet_sessions (user_id);
-- which Meet account hosts a meeting (null = made by Olaitan in the admin)
alter table meetings add column if not exists host_user int references meet_users (id) on delete cascade;   -- an account's meetings go with it
create index if not exists meetings_host_user on meetings (host_user, created_at desc);

-- install 2 (Nov 2026): the optional guest details form, the attendance list, and reports
-- the form a host chose for a meeting (null = no form): { phone, email: 'required'|'optional'|'off', org: bool, question: text|null, keep: days|0 (until deleted) }
alter table meetings add column if not exists form jsonb;
-- one row per join of a meeting that has a form: what the guest gave, and when they were in the meeting
create table if not exists meet_attendees (id serial primary key, code text not null references meetings (code) on delete cascade, identity text not null unique,
  name text not null, phone text, email text, org text, answer text, joined_at timestamptz not null default now(), left_at timestamptz, last_seen timestamptz,
  created_at timestamptz not null default now());
create index if not exists meet_attendees_code on meet_attendees (code, joined_at);
-- reports from people in a meeting (the reporter's address is kept only as a hash, to limit repeat reports)
create table if not exists meet_reports (id serial primary key, code text not null, reason text not null check (reason in ('spam', 'abuse', 'illegal', 'other')),
  note text, reporter_name text, ip_hash text, status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')), created_at timestamptz not null default now(), decided_at timestamptz);
create index if not exists meet_reports_open on meet_reports (created_at desc) where status = 'open';
