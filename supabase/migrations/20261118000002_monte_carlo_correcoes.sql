-- Monte Carlo: percentual de cenários que saíram da faixa de referência (pct_bound).
ALTER TABLE public.simulations ADD COLUMN IF NOT EXISTS pct_passou_limite numeric;
