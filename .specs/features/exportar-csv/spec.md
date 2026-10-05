# Exportar resultados em CSV — Especificação

## Problem Statement

Nenhum resultado do app pode ser levado para fora. Quem precisa montar um relatório ou uma planilha de hedge copia os números à mão da tela. A decisão AD-004 fixa o formato: CSV padrão Excel BR.

## Goals

- [ ] Toda ferramenta com resultado tabular ou série tem um botão "Exportar CSV".
- [ ] O arquivo abre no Excel pt-BR com colunas separadas e números reconhecidos como número.

## Out of Scope

| Item | Motivo |
|------|--------|
| Excel .xlsx | AD-004. |
| PDF / imprimir relatório | Não pedido. |
| Exportar dados de entrada (formulário) | O CSV inclui os parâmetros usados num cabeçalho; formulários não são exportados à parte. |
| Exportação feita pelo backend | Os dados já estão no navegador; gerar ali evita endpoint novo. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Formato | `;` como separador, vírgula decimal, UTF-8 com BOM, quebra de linha CRLF | AD-004; o BOM faz o Excel reconhecer acentos | y |
| Números no CSV | Sem separador de milhar e sem unidade dentro da célula; unidade vai no nome da coluna ("Preço (¢/lb)") | Excel converte "1.234,56" de forma inconsistente; "1234,56" sempre vira número | n |
| Parâmetros usados | Primeiras linhas do arquivo: "Parâmetro;Valor", depois uma linha vazia, depois a tabela | O arquivo se explica sozinho | n |
| Nome do arquivo | `<ferramenta>_<ativo>_<AAAA-MM-DD>.csv`, sem acentos nem espaços | Compatível com qualquer sistema | n |
| Ferramentas cobertas | Monte Carlo (série de percentis), VaR, Volatilidade (série), Stress, ARIMA (série), Jump Diffusion (série), Risco (percentis), Cenários (percentis), Metas (série MTM), Breakeven (histórico), Regressões (histórico), ATR (histórico), Fixações (série + sinais) | Todas que têm tabela ou série | n |

**Open questions:** none - todas resolvidas ou registradas acima.

---

## User Stories

### P1: Baixar o resultado ⭐ MVP

**User Story**: Como analista, quero baixar o resultado que estou vendo para trabalhar no Excel.

**Acceptance Criteria**:

1. WHERE a ferramenta exibe um resultado o `PageHeader` SHALL mostrar o botão "Exportar CSV".
2. WHILE não há resultado na tela o botão "Exportar CSV" SHALL ficar desabilitado com a dica "Gere um resultado para exportar."
3. WHEN o usuário clica em "Exportar CSV" THEN o navegador SHALL baixar o arquivo com o nome no padrão `<ferramenta>_<ativo>_<AAAA-MM-DD>.csv`.
4. The arquivo SHALL começar com o BOM UTF-8, usar `;` como separador e CRLF como quebra de linha.
5. The valores numéricos SHALL usar vírgula decimal e não SHALL ter separador de milhar.
6. The nomes de coluna SHALL estar em português e incluir a unidade entre parênteses.
7. The arquivo SHALL listar os parâmetros usados no cálculo antes da tabela.
8. IF um texto contém `;`, aspas ou quebra de linha THEN o valor SHALL ir entre aspas duplas, com aspas internas duplicadas.

**Independent Test**: teste unitário do gerador (`lib/csv.ts`) com número negativo, texto com `;` e aspas, valor nulo; abrir um CSV real do Monte Carlo no Excel pt-BR e conferir colunas e números.

---

## Edge Cases

- IF um valor é `null` ou `NaN` THEN a célula SHALL ficar vazia.
- WHEN a série tem mais de 10.000 linhas THEN o download SHALL completar sem travar a aba (geração em uma única passada, sem montar strings intermediárias por célula no DOM).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| EXP-01 | P1: Baixar o resultado (botão e estados) | - | Pending |
| EXP-02 | P1: Baixar o resultado (formato do arquivo) | - | Pending |
| EXP-03 | P1: Baixar o resultado (cabeçalho de parâmetros) | - | Pending |
| EXP-04 | P1: Baixar o resultado (cobertura das ferramentas) | - | Pending |

**Coverage:** 4 total, 0 mapeados (Medium).

## Success Criteria

- [ ] O CSV do Monte Carlo abre no Excel pt-BR com 8 colunas numéricas sem nenhum ajuste manual.
