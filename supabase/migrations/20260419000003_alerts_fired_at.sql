-- Migration 005: add fired_at to price_alerts for dedup
-- Run in Supabase SQL Editor or: supabase db push

alter table public.price_alerts
    add column if not exists fired_at timestamptz;

create index if not exists price_alerts_unfired_idx
    on public.price_alerts(user_id)
    where active = true and fired_at is null;
