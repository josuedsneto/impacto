# Validação — painel-hoje

## Requisitos e evidências

| ID | Requisito | Evidência |
|----|-----------|-----------|
| PNL-01 | Rota autenticada e com limite | `tests/test_contrato_rotas.py` (rota, parâmetros, dependência `get_current_user`, limite `30 per 1 minute`) — PASS |
| PNL-02 | Seção falha vira `dados: null` com motivo, sem vazar exceção | `tests/test_painel.py::test_falha_de_uma_secao_devolve_as_outras`, `::test_erro_inesperado_vira_motivo_generico` — PASS |
| PNL-03 | Seções em paralelo | `routers/painel.py` (`ThreadPoolExecutor`); coberto pelos testes acima |
| PNL-04 | Faixa do dólar em 21 dias úteis, mesmo modelo do câmbio | Código reusa `serie_fx`, `cambio.simular`, `cambio.bandas`; sem teste dedicado (ver "Fora da cobertura") |
| PNL-05 | Alertas do último dia útil e ativos (inteiro) | `secao_alertas`; janela coberta por `test_ultimo_dia_util_pula_fim_de_semana` — PASS |
| PNL-06 | Posições por usina com status, % e motivo | `test_com_preco_traz_mtm_e_status`, `test_preco_fora_mantem_percentual_e_status_sem_mtm` — PASS |
| PNL-07 | Preço fora não zera % fixado nem status; MTM null com aviso | `test_preco_fora_mantem_percentual_e_status_sem_mtm` — PASS |
| PNL-08 | Três análises mais recentes | `secao_analises`, `limit(3)`; sem teste dedicado |
| PNL-09 | Todas as consultas filtram por `user_id`; posições só pelas usinas do vínculo | Leitura de código: `secao_alertas`, `secao_analises`, `secao_posicoes` (`user_usinas.eq("user_id")`, `in_("usina_id", ids)`); ver "Fora da cobertura" |
| PNL-10 | Usuário sem usina recebe lista vazia | `test_usuario_sem_usina_recebe_lista_vazia` — PASS |
| PNL-11 | Registro em `main.py` | `main.py`: import e tupla do laço; `tests/test_rotas_autenticadas.py` — PASS |
| PNL-12 | Menu "Hoje" no topo | `components/layout/NavLinks.tsx`, linha da entrada Dashboard |
| PNL-13 | Ordem de urgência | `lib/painel.test.ts` (ordem fixada e ordenação de lista embaralhada) — PASS |
| PNL-14 | Cada cartão leva à ferramenta | `components/painel/Cartoes.tsx` e `app/app/dashboard/page.tsx` (`href` e `Link` por cartão) |
| PNL-15 | Variação da semana com referência de 7 dias corridos | `lib/painel.test.ts` ("semana usa o fechamento de 7 dias antes, não o de ontem") — PASS |
| PNL-16 | Focus com `FocusWidget` e `getFocus` | `page.tsx` (sem mudança de componente) |
| PNL-17 | Textos de posição com os cinco status e pontos em pt-BR | `lib/painel.test.ts` ("texto de posição", inclui 11,5 pontos) — PASS |
| PNL-18 | Estado vazio de alertas com atalho "Criar alerta" quando `ativos = 0` | `Cartoes.tsx` (`CartaoAlertas`); sem teste de renderização |
| PNL-19 | Sem usina → texto sem atalho; sem posições → "Cadastrar posições" | `Cartoes.tsx` (`CartaoPosicoes`, campo `n_posicoes`); sem teste de renderização |
| PNL-20 | `getPainelHoje` sem cache, timeout 15 s | `lib/dados-servidor.ts` |

## Comandos e resultados

- Backend, suíte completa: `C:/Users/jdlmg/OneDrive/Documentos/Josue/impacto/backend/.venv/Scripts/python.exe -m pytest tests -q` → **306 passed** (antes: 294).
- `test_calcs.py` → exit 0. `test_mensagens.py` → exit 0.
- Frontend: `npm test` → **372 passed**, 26 arquivos (antes: 362). `npm run lint` → exit 0. `npx tsc --noEmit` → exit 0.
- `npm run build` com Turbopack **falhou**: `Symlink [project]/node_modules is invalid, it points out of the filesystem root`. Causa: `node_modules` é junção para a checkout principal, e o Turbopack não aceita isso. O código não é a causa.
- `npx next build --webpack` com valores fictícios de `NEXT_PUBLIC_*` → **exit 0**.

## Revisão do advisor (diff final)

Corrigido após a revisão Opus do diff `f2ac0db..HEAD`:
- **Bug real:** `sb` era gravado antes da busca do dólar. Se só o dólar falhasse, `resumo_safra` recebia `fx = None` e a usina caía em erro genérico. Corrigido com atribuição da tupla inteira; teste `test_falha_so_no_dolar_zera_o_mtm_e_nao_quebra_a_usina`.
- **Mínimo/máximo nulos:** a leitura de posição usava `falta()` sobre o mínimo e o máximo. Agora segue o backend (0 e 100).
- **Pontos:** "12 pontos" sem ",0" (`formatPontos`), como pede AC-4.
- **Horário:** `formatDataHora` fixa `America/Sao_Paulo`, porque o servidor roda em UTC. Isso também muda a data de notícias e da conta, que já usavam esta função.
- **Aviso de preço:** texto fixo em português, sem o código `SB=F`.

## Fora da cobertura (e por quê)

- Renderização dos cartões: o repositório não tem React Testing Library. A ordem é testada na função `ordenar`; os estados vazios estão só no código.
- PNL-04, PNL-08 e o filtro de `secao_posicoes` por `user_usinas`: não há teste com a junção de `usinas(nome)`, porque o Supabase falso não suporta join embutido. O nome da usina fica `null` nos testes.
- Feriados brasileiros no "último dia útil" (A-3): não tratados, de propósito.

## Decisões para o usuário

1. **Cards removidos do Hoje:** o cartão "Resumo da conta" (última simulação e contagem do mês) saiu da tela, porque a lista de sete cartões do pedido não o inclui. Se quiser mantê-lo, ele volta como oitavo cartão.
2. **Feriados** no último dia útil (A-3).
3. **Build de produção:** o `next build` padrão (Turbopack) não funciona com `node_modules` por junção. Na CI (`npm ci`) não há junção, então não deve ocorrer; mas vale conferir no primeiro build real.

## Passo a passo de UAT

1. Aplicar nada no banco: esta frente não tem migration.
2. Entrar no app. O menu tem "Hoje" no topo, e a rota `/app/dashboard` continua a mesma.
3. Com uma usina associada e posições na safra atual (2026/27): o cartão "Posições da safra" mostra a frase "Você está X pontos abaixo/acima da política…" e, se o preço estiver disponível, "Resultado a mercado: R$ …".
4. Sem nenhuma usina associada ao usuário: o cartão diz "Sua conta não está associada a nenhuma usina. Fale com o administrador."
5. Usina sem posição na safra: aparece o link "Cadastrar posições".
6. Sem alertas ativos: o cartão "Alertas" mostra "Nenhum alerta disparou no último dia útil." e "Criar alerta".
7. Com alerta disparado no último dia útil: a lista aparece, com a mensagem e a data/hora.
8. Ordem dos cartões: alertas, posições, mercado, dólar em 1 mês, Boletim Focus, análises, notícias. Em tela estreita, uma coluna, na mesma ordem.
9. Cada cartão tem o link para a ferramenta dele.
10. Derrubar a API (ou o Yahoo) e recarregar: a tela abre, cada cartão de dado mostra o motivo, e os cartões de cotação mostram o erro no próprio lugar.
