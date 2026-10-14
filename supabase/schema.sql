-- Envara v1 schema. Run ONLY in a dedicated Envara Supabase project.
-- Existing legacy message rows lacking user_id remain inaccessible until explicitly assigned.
-- This migration intentionally removes older policies on the Envara messages table
-- to prevent permissive legacy policies from bypassing the new owner rules.

create extension if not exists pgcrypto;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade default auth.uid(),
  folder text not null default 'inbox',
  from_addr text not null default '',
  to_addr text not null default '',
  subject text not null default '',
  body text not null default '',
  is_read boolean not null default false,
  is_starred boolean not null default false,
  created_at timestamptz not null default now(),
  provider_message_id text,
  request_id uuid
);

-- Allow the schema to be applied to an older Envara messages table.
alter table public.messages add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.messages add column if not exists folder text not null default 'inbox';
alter table public.messages add column if not exists from_addr text not null default '';
alter table public.messages add column if not exists to_addr text not null default '';
alter table public.messages add column if not exists subject text not null default '';
alter table public.messages add column if not exists body text not null default '';
alter table public.messages add column if not exists is_read boolean not null default false;
alter table public.messages add column if not exists is_starred boolean not null default false;
alter table public.messages add column if not exists created_at timestamptz not null default now();
alter table public.messages add column if not exists provider_message_id text;
alter table public.messages add column if not exists request_id uuid;
alter table public.messages alter column user_id set default auth.uid();

create index if not exists messages_owner_date_idx on public.messages (user_id, created_at desc);
create unique index if not exists messages_owner_provider_idx on public.messages (user_id, provider_message_id);
create unique index if not exists messages_owner_request_idx on public.messages (user_id, request_id);

create table if not exists public.mailboxes (
  address text primary key check (address = lower(address)),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists mailboxes_owner_idx on public.mailboxes(user_id);

create table if not exists public.mail_send_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  provider_message_id text,
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);
create index if not exists mail_send_log_owner_date_idx on public.mail_send_log(user_id, created_at desc);

-- Clear previous policies so potentially overbroad legacy rules cannot remain active.
do $$
declare p record;
begin
  for p in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'messages'
  loop
    execute format('drop policy %I on public.messages', p.policyname);
  end loop;
end $$;

alter table public.messages enable row level security;
alter table public.mailboxes enable row level security;
alter table public.mail_send_log enable row level security;

-- Make this script safe to reapply after policy changes.
drop policy if exists envara_mailboxes_select on public.mailboxes;
drop policy if exists envara_send_log_select on public.mail_send_log;

-- Messages are private to their owner, even if another user knows an ID.
create policy envara_messages_select on public.messages for select to authenticated
  using (user_id = (select auth.uid()));
create policy envara_messages_insert on public.messages for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy envara_messages_update on public.messages for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy envara_messages_delete on public.messages for delete to authenticated
  using (user_id = (select auth.uid()));

-- Mailbox mappings are provisioned by the project owner, never by browser users.
create policy envara_mailboxes_select on public.mailboxes for select to authenticated
  using (user_id = (select auth.uid()));

-- Logs prevent casual repeated sending; users may read their own counts only.
create policy envara_send_log_select on public.mail_send_log for select to authenticated
  using (user_id = (select auth.uid()));
-- No client INSERT/UPDATE/DELETE policies. The sender uses a server-side service key.

revoke all on public.messages, public.mailboxes, public.mail_send_log from anon;
grant select,insert,update,delete on public.messages to authenticated;
grant select on public.mailboxes to authenticated;
grant select on public.mail_send_log to authenticated;
