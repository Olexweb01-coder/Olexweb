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
alter table meetings add column if not exists certs boolean not null default false;      -- Install D: certificates of attendance (Pro)
alter table meetings add column if not exists followup boolean not null default false;   -- Install D: AI notes emailed to attendees (Pro)
alter table meetings add column if not exists followup_at timestamptz;
alter table meetings add column if not exists personal boolean not null default false;   -- Install D: the host's personal room (/<their name>)
alter table meetings add column if not exists breakout jsonb;                -- Install D: breakout rooms while they're open
alter table meetings add column if not exists price int not null default 0;     -- Install D: paid meetings (a ticket price in naira; Olexweb keeps 5%)
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
-- Install D: names in the usage log (for certificates), and sign-ups for reminders before a scheduled meeting
alter table meet_usage add column if not exists name text;
create table if not exists meet_regs (id bigserial primary key, code text not null, name text not null, email text not null, created_at timestamptz not null default now(), sent jsonb not null default '[]');
create unique index if not exists meet_regs_one on meet_regs (code, lower(email));
-- Install D: hosts get paid (a Paystack subaccount: their bank; Olexweb keeps 5%), tickets, and mentorship bookings
alter table meet_users add column if not exists payout jsonb;                  -- {code, bankName, accountName, last4}
alter table meet_users add column if not exists booking jsonb;                 -- mentorship: {on, days, from, to, minutes, price, title}
alter table meet_payments add column if not exists buyer_name text;
alter table meet_payments add column if not exists buyer_email text;
alter table meet_payments add column if not exists pass text;                  -- a ticket's key (lets that person in)
alter table meet_payments add column if not exists booking_id bigint;
create unique index if not exists meet_payments_pass on meet_payments (pass) where pass is not null;
create table if not exists meet_bookings (id bigserial primary key, mentor int not null, mentee int not null, starts_at timestamptz not null, minutes int not null,
  code text, status text not null default 'pending', created_at timestamptz not null default now());
create unique index if not exists meet_bookings_slot on meet_bookings (mentor, starts_at) where status <> 'cancelled';
-- Install 58: the money engine. Amounts in new columns are kobo (₦1 = 100 kobo) unless the name says naira.
alter table meet_payments add column if not exists pct int;                    -- Olexweb's percent on this sale
alter table meet_payments add column if not exists olex_kobo bigint;            -- Olexweb's share, set on Paystack as transaction_charge
alter table meet_payments add column if not exists host_user int;               -- who the money is for (a host's sale)
alter table meet_payments add column if not exists link_id bigint;              -- the tracked link it came through
alter table meet_payments add column if not exists via text;                    -- 'directory' when the client came from Find a mentor
alter table meet_payments add column if not exists ref_id bigint;               -- the bundle, membership or certificate it pays for
alter table meet_payments add column if not exists seats int not null default 1;
create index if not exists meet_payments_host on meet_payments (host_user, status, paid_at);
alter table meet_users add column if not exists recipient text;                 -- Paystack transfer recipient (invite and ambassador cash)
alter table meet_users add column if not exists mentor jsonb;                   -- Find a mentor listing: {on, niche, tags, help[], city, years}
alter table meet_users add column if not exists membership jsonb;               -- {on, price, perMonth, perks:{free, discount}, line}
alter table meet_users add column if not exists cert_brand jsonb;               -- {org, variant, signature}
alter table meet_users add column if not exists ref_done_at timestamptz;
alter table meet_users add column if not exists ref_five boolean not null default false;   -- already counted towards a "5 invites" reward
-- tickets that let people in (one payment can buy several seats: group prices)
create table if not exists meet_passes (pass text primary key, payment_id bigint not null, code text, bundle_id bigint, created_at timestamptz not null default now());
create index if not exists meet_passes_code on meet_passes (code);
-- course bundles: several of a host's meetings as one ticket
create table if not exists meet_bundles (id bigserial primary key, host_user int not null references meet_users (id) on delete cascade, title text not null, blurb text not null default '', price int not null,
  early_price int, early_until timestamptz, group_size int, group_price int, on_sale boolean not null default true, created_at timestamptz not null default now());
create table if not exists meet_bundle_items (bundle_id bigint not null references meet_bundles (id) on delete cascade, code text not null, primary key (bundle_id, code));
create index if not exists meet_bundle_items_code on meet_bundle_items (code);
-- tracked links (closed sessions and anything sold): opened → started paying → paid
create table if not exists meet_links (id bigserial primary key, host_user int not null references meet_users (id) on delete cascade, slug text not null unique, label text not null, kind text not null, target text not null,
  opens int not null default 0, created_at timestamptz not null default now());
-- memberships: members pay a host monthly; no members-only meeting in a month = no charge (paused)
alter table meetings add column if not exists members_only boolean not null default false;
create table if not exists meet_members (id bigserial primary key, host_user int not null references meet_users (id) on delete cascade, user_id int not null references meet_users (id) on delete cascade, status text not null default 'pending',
  price int not null, period_start timestamptz, period_end timestamptz, auth_code text, auth_email text, cancel_at_end boolean not null default false,
  charging_at timestamptz, created_at timestamptz not null default now(), unique (host_user, user_id));
create index if not exists meet_members_due on meet_members (period_end) where status = 'active';
-- money Olexweb pays out (3% invites, ambassador prize), sent every Monday by Paystack Transfer
create table if not exists meet_credits (id bigserial primary key, user_id int not null references meet_users (id) on delete cascade, kind text not null, amount bigint not null, ref text not null unique, note text not null default '',
  status text not null default 'pending', transfer_ref text, created_at timestamptz not null default now(), paid_at timestamptz);
create index if not exists meet_credits_user on meet_credits (user_id, status);
alter table meet_settings add column if not exists payouts jsonb not null default '{}';
-- the spotlight beyond monthly winners (5 invites in 15 days): shown until "until"
create table if not exists meet_spot (id bigserial primary key, user_id int not null references meet_users (id) on delete cascade, reason text not null, until timestamptz not null, created_at timestamptz not null default now());
-- certificates: each one has its own code, checked at /v/<code>
alter table meetings add column if not exists cert_price int not null default 0;  -- naira; 0 = free (Pro hosts only)
alter table meetings add column if not exists cert_award text;                    -- e.g. 'Attendance', 'Completion', 'Excellence'
create table if not exists meet_certs (serial text primary key, code text not null, identity text not null, name text not null, award text not null, issued_at timestamptz not null default now(),
  payment_id bigint, revoked_at timestamptz, unique (code, identity));
-- bookings that waited too long to be paid free their time again
alter table meet_bookings add column if not exists via text;
alter table meet_members add column if not exists renew_ref text;            -- the automatic charge in progress (never two at once)
alter table meet_payments add column if not exists identity text;            -- a paid certificate: whose it is
alter table meet_credits add column if not exists sent_at timestamptz;
-- Install 58 (the new app): celebrations shown once, levels, What's new, photo and banner
alter table meet_badges add column if not exists seen_at timestamptz;
alter table meet_users add column if not exists level_seen int not null default 0;
alter table meet_users add column if not exists news_seen bigint not null default 0;
alter table meet_users add column if not exists welcomed boolean not null default false;   -- the first sign-in after Install 58 (past achievements unlocked)
alter table meet_users add column if not exists banner jsonb;                -- {kind: 'pattern' | 'image' | 'bio', pattern}
alter table meet_users add column if not exists photo_data text;             -- an uploaded photo (small JPEG, base64)
alter table meet_users add column if not exists banner_data text;            -- an uploaded banner (JPEG, base64)
alter table meet_settings add column if not exists news58 boolean not null default false;   -- the announcement below, posted once (delete it and it stays deleted)
insert into meet_news (title, body) select 'The new Olexweb Meet is here', 'A new home with a menu on every screen, levels and celebrations, your profile with a photo and banner, and new ways to earn: memberships, course bundles, Find a mentor, paid certificates and invite rewards. Every fee is shown before you earn.'
  where not (select news58 from meet_settings where id = 1);
update meet_settings set news58 = true where id = 1;
-- Install 58f: referral commission (30% for 12 months) can be paid out 14 days after the payment; a fixed Ambassador prize
alter table meet_credits add column if not exists available_at timestamptz not null default now();
alter table meet_settings add column if not exists ambassador_prize int not null default 5000;   -- naira; set in Admin → Meet → Money
-- Install 58h: the Paystack collection limit (Starter business) and the upgrade, noticed by itself
alter table meet_settings add column if not exists ps_limit int not null default 8000000;          -- naira; what Paystack shows on your dashboard (₦8M for a Starter business)
alter table meet_settings add column if not exists ps_registered boolean not null default false;  -- upgraded to a Registered business: no limit
alter table meet_settings add column if not exists ps_limit_hit_at timestamptz;                    -- the last time Paystack refused a payment over the limit
alter table meet_settings add column if not exists ps_manual boolean not null default false;     -- the admin said it themselves: don't guess
-- Install 58k: bonus Pro (gifts from Olexweb and the welcome bonus), each with its reason, its own dates, and cancellable
create table if not exists meet_pro_grants (id bigserial primary key, user_id int not null references meet_users (id) on delete cascade, kind text not null default 'gift',
  days int not null, reason text not null default '', starts_at timestamptz not null, ends_at timestamptz not null, created_at timestamptz not null default now(),
  cancelled_at timestamptz, cancel_reason text);
create index if not exists meet_pro_grants_user on meet_pro_grants (user_id);
alter table meet_settings add column if not exists welcome_days int not null default 0;            -- Pro for every new account (0 = off)
alter table meet_settings add column if not exists welcome_reason text not null default '';
alter table meet_settings add column if not exists welcome_until timestamptz;                       -- the offer ends (null = no end)
