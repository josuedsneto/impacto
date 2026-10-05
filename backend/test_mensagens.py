"""Checa que as mensagens de erro mostradas ao usuário estão em português (API-06).
Run: python test_mensagens.py"""
import ast
import re
from pathlib import Path

INGLES = re.compile(r"\b(must|not found|failed|invalid|insufficient|could not|provided|between|configured|submitted|already exists)\b", re.I)


def mensagens(arquivo: str) -> list[tuple[int, str]]:
    """Textos de detail= em HTTPException e de ValueError, com o número da linha."""
    tree = ast.parse(Path(arquivo).read_text(encoding="utf-8"))
    out = []
    for node in ast.walk(tree):
        # Campo "message" das respostas de sucesso também é lido pelo usuário.
        if isinstance(node, ast.Dict):
            for k, v in zip(node.keys, node.values):
                if isinstance(k, ast.Constant) and k.value == "message":
                    texto = "".join(c.value for c in ast.walk(v) if isinstance(c, ast.Constant) and isinstance(c.value, str))
                    out.append((node.lineno, texto))
            continue
        if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Name):
            continue
        if node.func.id == "HTTPException":
            alvos = [k.value for k in node.keywords if k.arg == "detail"]
        elif node.func.id == "ValueError":
            alvos = node.args[:1]
        else:
            continue
        for alvo in alvos:
            texto = "".join(
                c.value for c in ast.walk(alvo) if isinstance(c, ast.Constant) and isinstance(c.value, str)
            )
            if texto:
                out.append((node.lineno, texto))
    return out


achados = [
    f"{arq}:{linha}: {texto}"
    for arq in ("main.py", "auth.py", "options.py", "regression.py")
    for linha, texto in mensagens(arq)
    if INGLES.search(texto)
]
assert not achados, "Mensagens em inglês:\n" + "\n".join(achados)

# Mensagem de dados insuficientes no formato da spec.
textos = [t for _, t in mensagens("main.py")]
assert "Dados insuficientes para . Tente outro ativo ou período." in textos, textos

print("ok")
