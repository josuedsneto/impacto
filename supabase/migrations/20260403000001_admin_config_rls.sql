-- admin_config: enable RLS with no policies = deny all non-service-role access.
-- FastAPI reads/writes exclusively via service role key, which bypasses RLS.
-- This prevents any direct anon-key client from reading or writing config rows.
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;
