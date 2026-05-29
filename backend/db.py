import os
from functools import lru_cache

from supabase import Client, create_client


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Cliente Supabase service-role compartilhado (singleton).

    Usa SUPABASE_SERVICE_ROLE_KEY, portanto bypassa RLS — uso exclusivo do
    backend. A instância é reutilizada entre requests via cache, evitando
    recriar um cliente HTTP a cada chamada de endpoint.
    """
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )
