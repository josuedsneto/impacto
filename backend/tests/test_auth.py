"""Testes de auth.verify_jwt: a chave ES256 é gerada aqui, sem rede nem secrets."""
import sys
import time
from pathlib import Path

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import auth  # noqa: E402

ISSUER = "https://projeto-teste.supabase.co/auth/v1"


@pytest.fixture
def chave_ec():
    return ec.generate_private_key(ec.SECP256R1())


@pytest.fixture(autouse=True)
def configurar(monkeypatch, chave_ec):
    monkeypatch.setattr(auth, "_PUBLIC_KEY", chave_ec.public_key())
    monkeypatch.setattr(auth, "_ISSUER", ISSUER)


def _payload(**extra):
    agora = int(time.time())
    base = {
        "sub": "11111111-2222-3333-4444-555555555555",
        "aud": "authenticated",
        "iss": ISSUER,
        "iat": agora,
        "exp": agora + 3600,
        "email": "usuario@exemplo.com",
    }
    base.update(extra)
    return {k: v for k, v in base.items() if v is not None}


def _token_es256(chave, **extra):
    return jwt.encode(_payload(**extra), chave, algorithm="ES256")


def _verificar(token):
    return auth.verify_jwt(HTTPAuthorizationCredentials(scheme="Bearer", credentials=token))


def test_token_valido_passa_e_identifica_o_usuario(chave_ec):
    token = _token_es256(chave_ec)
    user = auth.get_current_user(_verificar(token))
    assert user["id"] == "11111111-2222-3333-4444-555555555555"
    assert user["email"] == "usuario@exemplo.com"


def test_token_expirado_retorna_401(chave_ec):
    token = _token_es256(chave_ec, exp=int(time.time()) - 60)
    with pytest.raises(HTTPException) as erro:
        _verificar(token)
    assert erro.value.status_code == 401
    assert "expirou" in erro.value.detail


@pytest.mark.parametrize(
    "extra",
    [
        {"aud": "anon"},
        {"iss": "https://outro-projeto.supabase.co/auth/v1"},
        {"iss": None},
        {"sub": None},
    ],
    ids=["aud_errada", "iss_de_outro_projeto", "sem_iss", "sem_sub"],
)
def test_claims_invalidas_retornam_401(chave_ec, extra):
    with pytest.raises(HTTPException) as erro:
        _verificar(_token_es256(chave_ec, **extra))
    assert erro.value.status_code == 401


def test_alg_diferente_de_es256_retorna_401():
    # HS256 assinado com segredo simétrico: não pode passar por ES256.
    token = jwt.encode(_payload(), "segredo-qualquer", algorithm="HS256")
    with pytest.raises(HTTPException) as erro:
        _verificar(token)
    assert erro.value.status_code == 401


def test_assinatura_de_outra_chave_retorna_401():
    outra = ec.generate_private_key(ec.SECP256R1())
    with pytest.raises(HTTPException) as erro:
        _verificar(_token_es256(outra))
    assert erro.value.status_code == 401


def test_sem_supabase_url_recusa_tudo_com_500(chave_ec, monkeypatch):
    monkeypatch.setattr(auth, "_ISSUER", "")
    with pytest.raises(HTTPException) as erro:
        _verificar(_token_es256(chave_ec))
    assert erro.value.status_code == 500
