-- Migration 006: invites + user_usinas role + share_links + cobertura_audit
-- Run in Supabase SQL Editor or: supabase db push

-- ── user_usinas: add role column ───────────────────────────────────────────────
alter table public.user_usinas
    add column if not exists role text not null default 'operator'
    check (role in ('viewer', 'operator', 'admin'));

-- ── invites ────────────────────────────────────────────────────────────────────
create table if not exists public.invites (
    id              uuid        primary key default gen_random_uuid(),
    usina_id        uuid        not null references public.usinas(id) on delete cascade,
    invited_by      uuid        not null,
    invited_email   text        not null,
    role            text        not null default 'operator' check (role in ('viewer','operator','admin')),
    token           text        not null unique,
    expires_at      timestamptz not null,
    accepted_at     timestamptz,
    created_at      timestamptz not null default now()
);
create index if not exists invites_token_idx on public.invites(token);
alter table public.invites enable row level security;
create policy "Admins manage usina invites"
    on public.invites for all
    using (
        exists (
            select 1 from public.user_usinas
            where user_id = auth.uid() and usina_id = invites.usina_id and role = 'admin'
        )
    );

-- ── share_links ────────────────────────────────────────────────────────────────
create table if not exists public.share_links (
    id          uuid        primary key default gen_random_uuid(),
    user_id     uuid        not null,
    type        text        not null default 'posicao' check (type in ('posicao','consolidado')),
    token       text        not null unique,
    expires_at  timestamptz not null,
    created_at  timestamptz not null default now()
);
create index if not exists share_links_token_idx   on public.share_links(token);
create index if not exists share_links_user_id_idx on public.share_links(user_id);
alter table public.share_links enable row level security;
create policy "Users manage own share links"
    on public.share_links for all
    using (auth.uid() = user_id);

-- ── cobertura_audit ────────────────────────────────────────────────────────────
create table if not exists public.cobertura_audit (
    id          uuid        primary key default gen_random_uuid(),
    fixacao_id  uuid,
    user_id     uuid        not null,
    action      text        not null check (action in ('created','deleted')),
    snapshot    jsonb       not null default '{}',
    created_at  timestamptz not null default now()
);
create index if not exists cobertura_audit_user_id_idx on public.cobertura_audit(user_id);
alter table public.cobertura_audit enable row level security;
create policy "Users read own audit"
    on public.cobertura_audit for select
    using (auth.uid() = user_id);

-- Trigger: log every INSERT on fixacoes_cobertura
create or replace function public.audit_fixacao_insert()
returns trigger language plpgsql security definer as $$
begin
    insert into public.cobertura_audit(fixacao_id, user_id, action, snapshot)
    values (new.id, new.user_id, 'created', row_to_json(new)::jsonb);
    return new;
end;
$$;
drop trigger if exists fixacao_audit_insert on public.fixacoes_cobertura;
create trigger fixacao_audit_insert
    after insert on public.fixacoes_cobertura
    for each row execute function public.audit_fixacao_insert();

-- Trigger: log every DELETE on fixacoes_cobertura
create or replace function public.audit_fixacao_delete()
returns trigger language plpgsql security definer as $$
begin
    insert into public.cobertura_audit(fixacao_id, user_id, action, snapshot)
    values (old.id, old.user_id, 'deleted', row_to_json(old)::jsonb);
    return old;
end;
$$;
drop trigger if exists fixacao_audit_delete on public.fixacoes_cobertura;
create trigger fixacao_audit_delete
    after delete on public.fixacoes_cobertura
    for each row execute function public.audit_fixacao_delete();
