-- Migration 004: subscriptions table for Stripe billing
-- Run in Supabase SQL Editor or: supabase db push

create table if not exists public.subscriptions (
    id                      uuid        primary key default gen_random_uuid(),
    user_id                 uuid        not null unique,
    plan                    text        not null default 'free'
                                        check (plan in ('free', 'pro', 'enterprise')),
    stripe_customer_id      text        unique,
    stripe_subscription_id  text,
    current_period_end      timestamptz,
    created_at              timestamptz not null default now(),
    updated_at              timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx        on public.subscriptions(user_id);
create index if not exists subscriptions_customer_id_idx    on public.subscriptions(stripe_customer_id);

alter table public.subscriptions enable row level security;

-- Users can read their own subscription; only service role can write
create policy "Users read own subscription"
    on public.subscriptions for select
    using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger subscriptions_updated_at
    before update on public.subscriptions
    for each row execute function public.set_updated_at();
