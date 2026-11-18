-- Segurança: a anon key é pública. Supabase concede privilégios a anon e
-- authenticated em public por padrão, então sem REVOKE qualquer um lê/escreve.
-- Nenhuma policy depende de anon; o backend usa service role (bypassa RLS e grants).

-- 1) anon não tem acesso a nenhuma tabela de public.
REVOKE ALL ON TABLE
  public.market_prices,
  public.market_coverage,
  public.tickers_catalog,
  public.simulations,
  public.user_parameters,
  public.watchlist,
  public.breakeven_simulations,
  public.risco_simulations,
  public.cenarios_simulations,
  public.regression_runs,
  public.usinas,
  public.user_usinas,
  public.atr_simulacoes,
  public.admin_config
FROM anon;

-- Vale só para tabelas criadas pelo role que roda a migration (postgres). Tabelas
-- criadas por supabase_admin (dashboard) não são cobertas; sequences e functions também não.
-- Tabelas criadas no futuro por este mesmo role também nascem sem grant para anon.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- 2) market_coverage e admin_config: só backend (service role). Sem acesso direto
--    para authenticated, e RLS ligado (sem policy = negado para quem não é service role).
ALTER TABLE public.market_coverage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.market_coverage, public.admin_config FROM authenticated;
