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

-- install 3 (Nov 2026): the usage meter. One row per person per meeting session, from LiveKit's signed webhook events.
create table if not exists meet_usage (id bigserial primary key, identity text not null unique, code text not null, joined_at timestamptz not null default now(), left_at timestamptz);
create index if not exists meet_usage_live on meet_usage (code) where left_at is null;
create index if not exists meet_usage_month on meet_usage (joined_at);
-- which video server: 'self' (ours, no limit) or 'cloud' (LiveKit Cloud, the backup); empty on meetings = cloud
alter table meet_usage add column if not exists server text not null default 'cloud';
alter table meetings add column if not exists server text;
-- audio or video, chosen before the meeting starts; video_at = when an audio call switched to video (never recorded as video)
alter table meetings add column if not exists mode text not null default 'video';
alter table meetings add column if not exists video_at timestamptz;
-- ratings: 1 to 5 stars and an optional review from anyone who was in the meeting (host = the host's own rating)
create table if not exists meet_ratings (id bigserial primary key, code text not null, identity text not null, host boolean not null default false,
  stars int not null check (stars between 1 and 5), review text, created_at timestamptz not null default now(), unique (code, identity));
create index if not exists meet_ratings_code on meet_ratings (code);
-- your limits (the plan you're on) and which warnings went out this month
create table if not exists meet_settings (id int primary key default 1 check (id = 1), minutes_allowance int not null default 5000, max_people int not null default 100,
  warned jsonb not null default '{}', updated_at timestamptz not null default now());
insert into meet_settings (id) values (1) on conflict do nothing;
-- AI notes in the Meet app: how many 5-minute pieces a meeting has had turned into text (free: the first 12, an hour)
alter table meetings add column if not exists notes_pieces int not null default 0;

-- install 5: email sign-in. Passwords are scrypt hashes; codes are hashes too, valid 10 minutes, 5 tries each.
alter table meet_users add column if not exists password_hash text;
create table if not exists meet_codes (id bigserial primary key, email text not null, purpose text not null check (purpose in ('signup', 'signin', 'reset')),
  code_hash text not null, name text, pw_hash text, attempts int not null default 0, ip_hash text, created_at timestamptz not null default now(), expires_at timestamptz not null, used_at timestamptz);
create index if not exists meet_codes_email on meet_codes (lower(email), created_at desc);
create index if not exists meet_codes_ip on meet_codes (ip_hash, created_at desc);
-- failed password attempts (to slow down guessing)
create table if not exists meet_login_fails (id bigserial primary key, email text not null, ip_hash text, at timestamptz not null default now());
create index if not exists meet_login_fails_email on meet_login_fails (lower(email), at desc);

-- co-hosts (by their identity in the meeting): they can mute, let speak, remove, record and take AI notes
alter table meetings add column if not exists cohosts jsonb not null default '[]'::jsonb;
-- Install B: plans and payments. Pricing is off until you turn it on (Admin → Meetings → Business); while it's off,
-- everything works and is free exactly as before.
alter table meet_settings add column if not exists pricing_on boolean not null default false;
alter table meet_settings add column if not exists prices jsonb not null default '{"month":4500,"year":45000,"meeting":1000,"extra":50}';
alter table meet_users add column if not exists pro_until timestamptz;               -- Pro for the account (monthly, yearly, rewards, gifts)
alter table meet_users add column if not exists phone text;                          -- optional, for support replies on WhatsApp
alter table meetings add column if not exists pro boolean not null default false;    -- Pro bought for this one meeting
alter table meetings add column if not exists extra_ok boolean not null default false; -- the host let more than 100 people in (paid per person)
alter table meetings add column if not exists e2ee_key text;                -- end-to-end encrypted meetings: the key (only given to people let in)
alter table meet_usage add column if not exists extra boolean not null default false;  -- joined when the meeting already had 100 people
create table if not exists meet_payments (id bigserial primary key, reference text not null unique, user_id int, kind text not null, code text, invoice_id bigint,
  amount int not null, status text not null default 'pending', created_at timestamptz not null default now(), paid_at timestamptz);
create table if not exists meet_invoices (id bigserial primary key, user_id int, code text not null unique, title text not null default '', people int not null default 0,
  blocks int not null default 0, amount int not null, created_at timestamptz not null default now(), paid_at timestamptz, paid_how text);
create index if not exists meet_invoices_due on meet_invoices (user_id) where paid_at is null;
-- announcements (everyone) and notices (one person: invoices, Pro, support replies)
create table if not exists meet_news (id bigserial primary key, title text not null, body text not null default '', created_at timestamptz not null default now());
create table if not exists meet_notices (id bigserial primary key, user_id int not null, title text not null, body text not null default '', link text, created_at timestamptz not null default now(), read_at timestamptz);
create index if not exists meet_notices_user on meet_notices (user_id, created_at desc);
-- support: Olex AI answers first; what it can't solve becomes a ticket for you
create table if not exists meet_tickets (id bigserial primary key, user_id int, email text, phone text, question text not null, ai_answer text, status text not null default 'open',
  reply text, created_at timestamptz not null default now(), replied_at timestamptz);
-- bank transfer (your account, you confirm each one) and which platform a payment went through
alter table meet_settings add column if not exists bank jsonb not null default '{}';
alter table meet_payments add column if not exists provider text not null default 'paystack';
-- Install C: protection, community and rewards
create table if not exists meet_limits (k text not null, win bigint not null, n int not null default 1, primary key (k, win));   -- request limits (stops floods)
alter table meet_users add column if not exists handle text;                 -- their public profile address: /meet/h/<handle>
alter table meet_users add column if not exists bio text;
alter table meet_users add column if not exists public boolean not null default false;   -- profile and leaderboard: only when they agree
alter table meet_users add column if not exists ref_code text;               -- their invite link
alter table meet_users add column if not exists referred_by int;
alter table meet_users add column if not exists ref_done boolean not null default false;
create unique index if not exists meet_users_handle on meet_users (lower(handle)) where handle is not null;
create unique index if not exists meet_users_ref on meet_users (ref_code) where ref_code is not null;
create table if not exists meet_follows (follower int not null, host int not null, created_at timestamptz not null default now(), primary key (follower, host));
create index if not exists meet_follows_host on meet_follows (host);
create table if not exists meet_badges (user_id int not null, badge text not null, earned_at timestamptz not null default now(), primary key (user_id, badge));
create table if not exists meet_rewards (user_id int not null, ref text not null, days int not null, created_at timestamptz not null default now(), primary key (user_id, ref));   -- each reward once
alter table meet_ratings add column if not exists user_id int;               -- the signed-in person who rated (for the review reward)
alter table meet_settings add column if not exists awards jsonb not null default '{}';   -- each month's winners (the spotlight)
