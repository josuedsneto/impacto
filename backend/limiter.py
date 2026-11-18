"""Limiter compartilhado (slowapi). Fica fora de main.py para routers poderem importar sem ciclo."""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
