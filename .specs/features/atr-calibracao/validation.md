# Validação — atr-calibracao

## Requisitos e evidências

| Req | Evidência | Resultado |
|---|---|---|
| ATRC-01 sigma = sqrt(SSR/(n-3)), cov, gl | `pytest tests/test_atr.py::test_sigma_usa_ssr_sobre_n_menos_3` | PASS |
| ATRC-02 mínimo de 12 meses | `test_com_11_meses_usa_coeficientes_do_setor`, `test_linhas_com_valor_faltando_nao_contam` | PASS |
| ATRC-03 colinearidade (variância nula; \|corr\| ≥ 0,95) | `test_chuva_constante_cai_no_setor_com_aviso`, `test_correlacao_acima_do_limite_cai_no_setor` (corr ≥ 0,95 verificada), `test_correlacao_abaixo_do_limite_calibra` (corr < 0,95 verificada) | PASS |
| ATRC-04 intervalo de previsão = obs_ci do statsmodels | `test_intervalo_de_previsao_bate_com_statsmodels` (tolerância 1e-3, resposta arredondada) | PASS |
| ATRC-05 coeficientes exatos sem ruído / recuperação com IC 95% | `test_coeficientes_exatos_sem_ruido`, `test_recupera_coeficientes_com_ruido_dentro_do_ic` | PASS |
| ATRC-06 calibra só com atr_medicoes; tabela ausente = setor; outro erro = 500 | `test_simulate_sem_tabela_usa_setor_e_nao_le_atr_simulacoes`, `test_simulate_outro_erro_do_banco_vira_500` | PASS |
| ATRC-07 resposta traz calibracao, meses_usados, aviso | `test_simulate_sem_tabela_usa_setor_e_nao_le_atr_simulacoes`, `test_simulate_conta_so_meses_validos` | PASS |
| ATRC-08 histórico filtra na query, sem user_id, com minha | `test_historico_filtra_na_query_e_nao_expoe_user_id` | PASS |
| ATRC-09 aviso e indicação na tela | `npm test` (251 testes), `npx tsc --noEmit` | PASS (ver UAT para a tela) |

## Comandos e resultados

- `cd backend && <venv>/python.exe -m pytest tests -q` → **36 passed**.
- `cd backend && python test_calcs.py` → ok.
- `cd backend && python test_mensagens.py` → ok.
- `cd frontend && npm test` → **13 arquivos, 251 testes passed**.
- `cd frontend && npx tsc --noEmit` → exit 0.
- `cd frontend && npm run lint` → 1 erro **pré-existente** em `components/ui/input.tsx:4` (`no-empty-object-type`). O arquivo não foi alterado nesta feature (`git diff HEAD` vazio para ele). Fora do escopo; corrigir em outra tarefa.
- `cd frontend && npm run build` → exit 0 (rotas `/app/atr` e demais compiladas).

## Decisões de implementação

- Dependência: `atr-dados-reais` cria `atr_medicoes` com as colunas fixadas na spec. Até lá, a calibração usa o setor e a tela mostra o aviso.
- `PGRST205` e `42P01` tratados como tabela ausente; demais erros propagam.
- Débitos registrados, não tratados: `float()` em valor não numérico em `_valido` lança `ValueError` (PostgREST entrega colunas numéricas, então não ocorre hoje); `atr_simulacoes` não grava o modo de calibração.

## UAT (passo a passo para o usuário)

1. Abra a tela **ATR**, escolha a usina e clique em **Simular** com chuva 100 mm e impureza 12 %.
   - Esperado enquanto `atr_medicoes` não existir: aparece **"Usando coeficientes padrão; lance dados reais de ATR."** abaixo dos números.
2. Abra a aba **Histórico**.
   - Esperado: as suas simulações têm o botão de compartilhar; simulações de outros membros, quando compartilhadas, aparecem sem o botão.
3. Depois que `atr-dados-reais` for entregue e a usina tiver 12 ou mais meses medidos:
   - Esperado: aparece **"Calibrado com <n> meses medidos da usina."**
