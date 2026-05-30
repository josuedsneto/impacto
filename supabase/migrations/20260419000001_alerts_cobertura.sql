-- Migration 003: price_alerts + fixacoes_cobertura + simulations status column
-- Run in Supabase SQL Editor or via: supabase db push

-- ── price_alerts ───────────────────────────────────────────────────────────────
create table if not exists public.price_alerts (
    id          uuid        primary key default gen_random_uuid(),
    user_id     uuid        not null,
    ticker      text        not null,
    condition   text        not null check (condition in ('above', 'below')),
    price       float       not null,
    label       text,
    active      boolean     not null default true,
    created_at  timestamptz not null default now()
);
create index if not exists price_alerts_user_id_idx on public.price_alerts(user_id);
alter table public.price_alerts enable row level security;
create policy "Users manage own alerts"
    on public.price_alerts for all
    using (auth.uid() = user_id);

-- ── fixacoes_cobertura ─────────────────────────────────────────────────────────
create table if not exists public.fixacoes_cobertura (
    id              uuid    primary key default gen_random_uuid(),
    user_id         uuid    not null,
    ticker          text    not null default 'SB=F',
    volume          float   not null,
    preco           float   not null,
    data_fixacao    date    not null,
    label           text,
    created_at      timestamptz not null default now()
);
create index if not exists fixacoes_cobertura_user_id_idx on public.fixacoes_cobertura(user_id);
alter table public.fixacoes_cobertura enable row level security;
create policy "Users manage own fixacoes"
    on public.fixacoes_cobertura for all
    using (auth.uid() = user_id);

-- ── simulations: add status column (for background task pattern) ───────────────
alter table public.simulations
    add column if not exists status text not null default 'done';
