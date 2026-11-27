create extension if not exists pgcrypto;

create table if not exists public.clients (
    id text primary key,
    name text not null check (char_length(btrim(name)) between 1 and 120),
    company text not null default '',
    email text not null default '',
    phone text not null default '',
    project_details text not null default '',
    notes text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.followups (
    id text primary key,
    client_id text not null references public.clients(id) on delete cascade,
    title text not null check (char_length(btrim(title)) between 1 and 200),
    description text not null default '',
    due_date date not null,
    priority text not null check (priority in ('high', 'medium', 'low')),
    status text not null check (status in ('pending', 'completed')),
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
    id text primary key,
    client_id text references public.clients(id) on delete set null,
    followup_id text references public.followups(id) on delete set null,
    action text not null,
    description text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_followups_client on public.followups(client_id);
create index if not exists idx_followups_due_date on public.followups(due_date);
create index if not exists idx_followups_status on public.followups(status);
create index if not exists idx_activity_created_at on public.activity_logs(created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_clients_updated_at on public.clients;
create trigger trg_clients_updated_at before update on public.clients
for each row execute function public.touch_updated_at();

drop trigger if exists trg_followups_updated_at on public.followups;
create trigger trg_followups_updated_at before update on public.followups
for each row execute function public.touch_updated_at();

alter table public.clients enable row level security;
alter table public.followups enable row level security;
alter table public.activity_logs enable row level security;

grant usage on schema public to service_role, anon, authenticated;
grant select, insert, update, delete on public.clients, public.followups, public.activity_logs to service_role;
