# Alertas de mercado — Especificação

## Problem Statement

O usuário acompanha preço, variação e volatilidade do açúcar e do dólar pelo app, mas precisa abrir a tela para saber se um nível foi atingido. Não há aviso. Quem trabalha com risco de caixa perde a janela de decisão quando o preço cruza um nível combinado ou quando a volatilidade sobe além do que ele aceita.

O MVP cria regras de alerta por usuário, avaliadas por um job agendado, com envio por e-mail. Uma segunda entrega (P2) acrescenta um briefing diário opt-in.

## Goals

- [ ] Usuário cria, pausa e apaga até 20 regras de alerta na tela `/app/alertas`.
- [ ] Três tipos avaliados no MVP: `preco_cruza`, `variacao_diaria`, `vol_acima`.
- [ ] (Rodada 2) Quarto tipo `prob_cruzar`: probabilidade de o câmbio tocar um nível em até N dias úteis (`cambio.py`).
- [ ] (Rodada 2) Quinto tipo `posicao_limite`: % fixado da safra fora da política de hedge.
- [ ] (Rodada 2) Canal Telegram com vínculo por código.
- [ ] Cada regra dispara **na transição** (condição passou de falsa para verdadeira) e respeita cooldown.
- [ ] Cada disparo grava um evento (um por regra por dia) e envia e-mail; falha de envio fica registrada, não quebra o job.
- [ ] (P2) Briefing diário por e-mail para quem optou.

## Out of Scope

| Item | Motivo |
|------|--------|
| Alerta de `prob_cruzar` com dados intradiários | Usa fechamentos diários do cache, como os demais tipos. |
| Telegram para o briefing diário | Só alertas usam o canal Telegram nesta rodada. |
| Reenvio de alerta de Telegram que falhou | Mesma regra de DEC-07 (sem reenvio). |
| Avaliação a cada 15 min no pregão | O plano Hobby da Vercel permite só cron diário (ver DEC-02). Caminho de upgrade descrito abaixo. |
| Alerta em tempo real, push, SMS | Fora do escopo do pedido. |
| Refatorar `/api/volatility` para usar a função nova | Mudança em `main.py` fora da linha de include. A conta é replicada e coberta por teste de paridade. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| DEC-01 Plano Vercel | Hobby: cada cron roda no máximo 1x/dia, com precisão de hora (um `0 21` dispara entre 21:00 e 21:59). Usamos 2 crons. Fontes divergem sobre o número máximo de crons no Hobby (2 em páginas antigas; 100 na documentação atual): o desenho não depende disso. Cron mais frequente que diário quebra o deploy no Hobby. | Desenho que cabe no caso mais restritivo. | n — usuário confirma o plano |
| DEC-02 Frequência de `preco_cruza` | Avaliado 1x/dia, após o fechamento (21:00 UTC seg–sex = 18:00 de Brasília). Upgrade para Pro: adicionar entrada `*/15 12-20 * * 1-5` com `?tipos=preco_cruza` em `vercel.json`; a rota já aceita o filtro. | Único agendamento que roda no Hobby. Cache guarda barras diárias, então intradiário não existe hoje. | n |
| DEC-03 Hora na mensagem | Cache guarda barras diárias sem horário. Mensagem: "Cotação de DD/MM/AAAA (último pregão no cache). Avaliado às HH:MM (Brasília)." | Honesto: o fechamento intradiário é provisório e o cache não tem hora. | n |
| DEC-04 Primeira avaliação | `POST /api/alertas` e `PATCH` com `ativo=true` avaliam a regra na hora e gravam `ultimo_estado` (sem disparar). Se `ultimo_estado` ainda é nulo na rodada do job, o job só grava o estado e não dispara. | Sem isso, regra criada ao meio-dia que cruza às 17h perde o alerta no cron das 21h (advisor, ALTA). Desvia do texto "não ultimo_estado" (null trataria como falso). | n |
| DEC-05 Estado sempre atualizado | `ultimo_estado` é gravado a cada avaliação bem-sucedida, disparando ou não. | Sem isso a transição seguinte fica errada. | — |
| DEC-06 Ordem e idempotência | `unique(rule_id, dia)`. Sequência: (a) `upsert(..., on_conflict="rule_id,dia", ignore_duplicates=True)` com `enviado=false`; se devolve `data == []`, a regra já tem evento no dia e o job para aí; (b) grava `ultimo_estado`/`ultimo_disparo`; (c) envia; (d) `update enviado=true`. Estado gravado antes do envio: se o envio falha, não há reenvio no dia seguinte por "transição fantasma". `dia` = data de Brasília calculada no job (`America/Sao_Paulo`). Erro de FK (regra apagada no meio) é capturado por regra e não derruba o job. | Evita e-mail duplicado e evita disparo repetido por estado não gravado. | — |
| DEC-07 Resend sem chave | Evento gravado com `enviado=false` e `erro="E-mail não configurado (RESEND_API_KEY)"`. O slot do dia fica ocupado. Sem reenvio automático. | Pedido do usuário: não quebrar o job. Reenvio fica para v2. | n |
| DEC-08 Testar regra | `/testar` avalia agora e devolve resultado; não grava estado, evento nem e-mail. | Teste sem efeito colateral. | n |
| DEC-09 Autorização do job | `require_job_secret`: header `X-Job-Secret` comparado com `JOBS_SECRET` por `hmac.compare_digest`. Sem `JOBS_SECRET` configurado → 503 (falha fechada). | Pedido: mesma semântica do cache-yahoo. | — |
| DEC-10 Rate limit | Cada router cria um `Limiter(key_func=get_remote_address)` próprio, aplicado a `POST` e `/testar` (que pode ir ao Yahoo). Não importa `main`, evitando import circular. Os handlers de `RateLimitExceeded` não estão registrados em `main.py` (pré-existente: estourar o limite dá 500); fica como pendência, não é corrigido aqui. | Sem mexer em `main.py` além do include. | n |
| DEC-11 Acesso aos dados | Backend usa `supa_client()` (service role) e filtra sempre `user_id` nas consultas. RLS continua valendo para acesso direto. | Padrão atual do backend. | — |
| DEC-12 Dependência nova | Nenhuma. `requests` já instalado. | — | — |
| DEC-13 Vol 30d | `desvio-padrão amostral (ddof=1) dos últimos 30 log-retornos × √252`, em %. Mesma conta de `/api/volatility`. | Pedido. | — |
| DEC-14 Janela de dados | `get_prices` de hoje − 400 dias até hoje (cobre 30 retornos e a variação do dia). | Uma leitura por ticker por rodada. | — |
| DEC-15 Dado velho ou falha de ticker | `get_prices` não lança quando o Yahoo falha: devolve o que está no cache (aviso no log). Por isso o job checa a data da última barra: se for anterior a 4 dias corridos de hoje, ou se não há dados, as regras desse ticker são puladas (`puladas` no resumo), sem alterar estado. Exceção no `get_prices` também pula só esse ticker. | Evita avaliar preço de semanas atrás como se fosse atual. | — |
| DEC-16 Vercel duration | Rota do Next com `maxDuration = 60`. Se o backend passar disso, a rota responde timeout mas o job segue no Railway. | Limite do plano. Risco registrado; a rodada é idempotente pelo `unique`. | n |
| DEC-17 E-mail de destino | `supa.auth.admin.get_user_by_id(user_id)`, uma vez por usuário por rodada. Sem coluna nova. Sem e-mail: evento com `erro` preenchido. | Sem duplicar dado de usuário. | — |
| DEC-18 Cooldown e variação | `cooldown_horas` entre 24 e 720 (cron diário). `variacao_diaria` segue a regra de transição: dois dias seguidos acima do limite disparam uma vez. Transição que cai no cooldown é perdida até a condição voltar a falsa; isso é aceito e documentado para o usuário na tela. | Simples e previsível. | n |
| DEC-19 Rota de cron | `GET` (é como a Vercel chama). `CRON_SECRET` ausente → 503. Comparação com `hmac.compare_digest`. `JOBS_SECRET` e `CRON_SECRET` só no servidor, sem `NEXT_PUBLIC_`. | Evita `Bearer undefined` aceito. | — |
| DEC-20 `prob_cruzar` | `params`: `nivel` (>0), `direcao` (`acima`/`abaixo`), `horizonte` (1 a 252 dias úteis), `prob` (0 < prob ≤ 1). Valor = fração de caminhos que tocam o nível no fechamento diário (monitoramento só no fechamento, por isso a probabilidade é menor que a intradiária) em até `horizonte` dias. Condição = valor ≥ `prob`. Limitação aceita: se o nível já está do lado da direção (ex.: `acima` com nível abaixo do spot), o valor fica perto de 1; não há bloqueio na criação nesta rodada, a tela explica. Modelo: `cambio.simular` (EWMA + resíduos reamostrados), 5.000 caminhos, drift zero, sobre `cambio.limpar`. Mínimo de 60 fechamentos limpos, senão `DadosInsuficientes`. | Pedido do usuário. Direção explícita: `acima` conta máximo ≥ nível; `abaixo` conta mínimo ≤ nível (não depende de nível estar acima ou abaixo do spot, diferente de `prob_tocar`). | n |
| DEC-21 Semente do `prob_cruzar` | `seed = int(sha256(f"{rule_id}|{dia}")[:8], 16)`, com `dia` = data de Brasília da avaliação. Mesma regra, mesmo dia e mesma série dão o mesmo número. `/testar` às 14h e o job às 21h podem ver fechamentos diferentes; a semente muda todo dia, então uma regra rente ao limiar pode disparar de novo após o cooldown (erro de Monte Carlo com 5.000 caminhos ≈ 0,7 p.p. perto de 50%). Não usa `hash()` do Python (muda entre processos). | Reprodutível, como pedido. | — |
| DEC-22 `posicao_limite` | `params`: `usina_id`, `safra`. Ticker gravado como `POSICAO` (não é ticker de mercado; o job não busca preço para ele). Condição = status `abaixo` ou `acima` da política (`politica_hedge.situacao`, mesma função de `GET /api/posicoes/resumo`). `sem_politica` ou `sem_producao` → `DadosInsuficientes` (regra pulada). Valor = `pct_fixado`. Criação exige membro da usina (`user_usinas`), senão 403. O job também confere a cada rodada: quem saiu da usina tem a regra contada como pulada (`PermissaoPerdida`), sem ler nem enviar dados da usina. | Regra por usina e safra, sem duplicar cálculo. Decisão: a checagem de membro roda na criação e em cada rodada do job. | n |
| DEC-23 Telegram | Tabela `telegram_vinculos` (`user_id` PK, `chat_id` único, `codigo`, `codigo_expira`). `POST /api/telegram/codigo` gera código de 8 caracteres (`secrets`), válido 15 min, de uso único. Webhook `POST /api/telegram/webhook` valida `X-Telegram-Bot-Api-Secret-Token` com `hmac.compare_digest` (sem `TELEGRAM_WEBHOOK_SECRET` → 503). Reconhece `/start CODIGO`; grava `chat_id` e apaga o código. Envio por `POST https://api.telegram.org/bot<TOKEN>/sendMessage` com `requests`. Sem `TELEGRAM_BOT_TOKEN` o canal aparece indisponível e o job grava erro. Criar regra com `canal=telegram` exige vínculo (422 se não houver). Só chats privados (`chat.type == "private"`) vinculam; grupo recebe a mensagem de recusa. Se o `chat_id` já pertence a outra conta, o webhook responde que o Telegram já está vinculado a outra conta e não grava. O webhook responde 200 em todos os casos de mensagem (código inválido inclusive), para o Telegram não reenviar. Validação e consumo do código são uma única operação (`UPDATE ... WHERE codigo = X AND codigo_expira > now() RETURNING`). Alfabeto do código: `ABCDEFGHJKMNPQRSTUVWXYZ23456789`. `POST /api/telegram/codigo` tem rate limit (5/min). Erro de envio pelo Telegram grava mensagem fixa (`Falha no envio pelo Telegram`) e o log registra só o tipo da exceção, nunca o texto nem o traceback, porque a URL da Bot API contém o token. | Pedido do usuário. Código curto evita colar token longo; expira e é de uso único. | — |
| DEC-24 Briefing: horário e opt-in | Cron `30 10 * * 1-5` (10:30 UTC = 07:30 de Brasília, como pedido). No Hobby, a precisão é de hora: a execução cai entre 10:00 e 10:59 UTC, ou seja, entre 07:00 e 07:59 de Brasília. A tela diz "entre 7h e 8h", não "às 7h30". Os envios são espaçados (~0,6 s, limite de 2 req/s do Resend) para caber nos 60 s. Opt-in em `preferencias_usuario.briefing_email` (RLS próprio). Usuário sem opt-in nunca recebe. | Pedido do usuário; limite do plano (ver DEC-01). | n |
| DEC-25 Manchetes do briefing | `backend/noticias.py` com a mesma URL e o mesmo parse de `main.get_news` (Google News RSS). `main.py` não é tocado nesta rodada, então a função de `main` continua com a sua cópia. Débito: unir as duas quando `main.py` for dividido. | Não mexer em `main.py` além do include. | n |
| DEC-26 Briefing: conteúdo e falhas | Spot e variação de SB=F e USDBRL=X com a data do último fechamento. Focus: `fetch_indicator("Câmbio", ano)` e `("Selic", ano)` com `ano` = ano corrente. Se uma seção falha, o e-mail sai com "indisponível" nela; o job não cai. Alertas de ontem = eventos do próprio usuário com `dia` igual ao último dia útil anterior (Brasília); segunda-feira pega sexta. Feriados não tratados nesta rodada. | Degrada sem derrubar o envio. | n |
| DEC-27 Envio com HTML | `enviar_email` aceita `html` opcional; com `html`, o Resend recebe `html` e `text`. | Briefing em HTML simples com versão em texto. | — |

**Open questions:**
- Plano da Vercel (DEC-01) e se o usuário quer pagar Pro para intradiário (DEC-02).
- Hora da cotação: aceito o texto de DEC-03?

---

## User Stories

### P1: Criar e gerir regras ⭐ MVP

**User Story**: Como usuário, quero criar regras de alerta para um ativo, com nível, variação ou volatilidade, e pausá-las sem apagar.

**Acceptance Criteria**:

1. WHEN o usuário envia `POST /api/alertas` com `tipo`, `ticker`, `params`, `cooldown_horas` (24 a 720) válidos THEN a API SHALL criar a regra com `ativo=true`, avaliá-la uma vez para gravar `ultimo_estado` (DEC-04) e devolvê-la com `201`.
2. WHEN o `params` não bate com o schema do `tipo` (Pydantic por tipo) THEN a API SHALL responder `422` com mensagem em português.
3. WHEN o usuário já tem 20 regras THEN a API SHALL responder `400` "Limite de 20 alertas por conta atingido. Apague um alerta para criar outro."
4. WHEN o usuário chama `PATCH /api/alertas/{id}` com `ativo` THEN a API SHALL alterar só esse campo, e `ultimo_estado` SHALL ser mantido.
5. WHEN o usuário chama `PATCH`, `DELETE` ou `/testar` numa regra alheia, ou `/eventos` de regra alheia THEN a API SHALL responder `404`.
6. WHEN o `tipo` não existe ou o `canal` é `telegram` sem vínculo (DEC-23) THEN a API SHALL responder `422` com mensagem em português ("Vincule o Telegram antes de usar este canal.").

**Independent Test**: `pytest backend/tests/test_alertas_api.py` com Supabase simulado.

### P1: Avaliação pura ⭐ MVP

**User Story**: Como desenvolvedor, quero a regra de cada tipo numa função pura, para testar sem rede.

**Acceptance Criteria**:

1. `avaliar(regra, serie) -> (condicao: bool, valor: float | None, mensagem: str)` SHALL ser pura (sem I/O).
2. WHEN `preco_cruza` com `direcao="acima"` e último fechamento ≥ `nivel` THEN `condicao` SHALL ser verdadeira; `"abaixo"` é o inverso.
3. WHEN `variacao_diaria` THEN `condicao` SHALL ser `|último/anterior − 1| × 100 ≥ pct`.
4. WHEN `vol_acima` THEN o valor SHALL ser a vol 30d em % (DEC-13; `/api/volatility` devolve fração, então multiplica por 100) e `condicao` SHALL ser `valor ≥ pct`.
5. WHEN a série tem menos dados que o necessário THEN `avaliar` SHALL levantar `DadosInsuficientes`, e o job SHALL tratar como DEC-15.
6. WHEN `vol_acima` é avaliado THEN o valor SHALL coincidir com `numpy` na fórmula de `/api/volatility` (teste de paridade com série fixa que inclui um fechamento `None`, descartado antes do log-retorno, como em `main.py`).

**Independent Test**: `pytest backend/tests/test_alertas_avaliar.py`.

### P1: Disparo na transição ⭐ MVP

**User Story**: Como usuário, quero um aviso quando a condição acontece, e não um e-mail a cada rodada enquanto ela continua verdadeira.

**Acceptance Criteria**:

1. WHEN `condicao` é verdadeira, `ultimo_estado` é falso e `ultimo_disparo` está fora do cooldown THEN o job SHALL disparar.
2. WHEN `ultimo_estado` é nulo THEN o job SHALL só gravar o estado (DEC-04).
3. WHEN a regra dispara THEN o job SHALL gravar `ultimo_estado=true` e `ultimo_disparo=now()`.
4. WHEN a condição é falsa THEN o job SHALL gravar `ultimo_estado=false` sem disparar.
5. WHEN a regra já tem evento no dia THEN o job SHALL não enviar outro (DEC-06).

**Independent Test**: sequência de rodadas simuladas: falso→verdadeiro envia uma vez; verdadeiro→verdadeiro não envia.

### P1: Job agendado e envio ⭐ MVP

**User Story**: Como usuário, quero receber o e-mail do alerta no mesmo dia, sem depender de eu abrir o app.

**Acceptance Criteria**:

1. WHEN a Vercel chama `GET /api/cron/alertas` com `Authorization: Bearer CRON_SECRET` THEN a rota SHALL chamar `POST /api/jobs/alertas` com `X-Job-Secret`.
2. IF `CRON_SECRET` não confere THEN a rota SHALL responder `401`. IF `CRON_SECRET` não está configurado THEN a rota SHALL responder `503`.
3. WHEN o job roda THEN ele SHALL chamar `get_prices` uma vez por ticker e SHALL responder `{avaliadas, disparadas, puladas, erros}`.
4. WHEN o envio por Resend falha ou não há chave THEN o evento SHALL ficar com `enviado=false` e `erro` preenchido (DEC-07).
5. The mensagem SHALL conter a data do último pregão e a hora da avaliação (DEC-03).
6. WHEN `JOBS_SECRET` não confere ou não existe THEN o backend SHALL responder `401` ou `503`, nunca executar.

**Independent Test**: teste do endpoint com `JOBS_SECRET` de teste e Resend simulado.

### P1: Tela de alertas ⭐ MVP

**User Story**: Como usuário, quero ver minhas regras, pausar uma delas e conferir o histórico de disparos numa tela só.

**Acceptance Criteria**:

1. WHEN a tela carrega THEN SHALL listar as regras com tipo, ativo, condição em texto, último disparo e um interruptor de ativo.
2. WHEN o usuário preenche o formulário THEN SHALL oferecer tipo, ticker (de `lib/ativos.ts`), nível ou % e cooldown; SHALL recusar a criação quando já há 20 regras, com a mesma mensagem do critério 3 de "Criar e gerir regras".
3. WHEN o usuário aciona "Testar" THEN SHALL mostrar o resultado de `/testar`.
4. The histórico SHALL listar os eventos com data, regra, mensagem e status de envio.
5. The entrada "Alertas" SHALL aparecer em `NavLinks.tsx` na seção Risco, sem alterar outras entradas.

### P1: Segurança dos dados

**User Story**: Como usuário, quero que minhas regras e meus eventos fiquem só comigo.

**Acceptance Criteria**:

1. The tabelas `alert_rules` e `alert_events` SHALL ter RLS ligado. `alert_rules`: CRUD só nas próprias linhas. `alert_events`: leitura só das próprias.
2. The API SHALL filtrar `user_id` em toda consulta, mesmo com service role.
3. Política de `alert_rules`: `using (auth.uid() = user_id) with check (auth.uid() = user_id)`. Pelo PostgREST direto o usuário pode alterar `ultimo_estado`; aceito, porque o efeito é só recalcular a próxima transição. `on delete cascade` apaga o histórico junto com a regra; a tela avisa isso no botão de apagar.

### P2: Briefing diário ⭐ Segunda entrega

**User Story**: Como usuário que optou, quero um e-mail às 7h30 com o resumo do mercado.

**Acceptance Criteria**:

1. WHEN o usuário ativa a opção em `Alertas` THEN a tabela `preferencias_usuario` SHALL gravar `briefing_email=true` (RLS: CRUD próprio).
2. WHEN o cron de `30 10 * * 1-5` roda (DEC-24: 07:30 de Brasília, mas no Hobby a execução cai entre 10:00 e 10:59 UTC) THEN a rota SHALL chamar `POST /api/jobs/briefing` com `X-Job-Secret`.
3. The e-mail SHALL conter: spot e variação de açúcar e dólar com a data; Focus; as 3 primeiras manchetes; alertas disparados ontem.
4. WHEN um usuário não tem opt-in THEN o job SHALL não enviar nada a ele.

### P1 (rodada 2): Probabilidade de cruzar ⭐

**User Story**: Como trader de câmbio, quero um aviso quando a chance de o dólar tocar um nível em alguns dias úteis passar de um limite que eu escolho.

**Acceptance Criteria**:

1. WHEN o usuário cria `prob_cruzar` com `nivel`, `direcao`, `horizonte` (1 a 252) e `prob` (0 < prob ≤ 1) válidos THEN a API SHALL aceitar a regra (`201`) e avaliá-la para gravar `ultimo_estado` (DEC-04).
2. WHEN `avaliar` roda para `prob_cruzar` THEN o valor SHALL ser a fração de caminhos que tocam o nível em até `horizonte` dias úteis (DEC-20) e `condicao` SHALL ser `valor ≥ prob`.
3. WHEN a avaliação roda com a mesma regra e o mesmo dia THEN o valor SHALL ser idêntico em duas chamadas (DEC-21).
4. WHEN `POST /api/alertas/{id}/testar` roda para `prob_cruzar` THEN SHALL devolver valor, condição e mensagem com a probabilidade em %, sem gravar nada.
5. The tela SHALL oferecer o tipo com nível, direção, horizonte em dias úteis e probabilidade em %.

**Independent Test**: `pytest backend/tests/test_alertas_prob.py` com série sintética (passeio determinístico e série com tendência): probabilidade em [0,1], monotônica no nível, reprodutível pela semente.

### P1 (rodada 2): Alerta de posição fora da política ⭐

**User Story**: Como gestor de hedge, quero um aviso quando o % fixado de uma safra sai da faixa da política.

**Acceptance Criteria**:

1. WHEN o usuário que é membro da usina cria `posicao_limite` com `usina_id` e `safra` THEN a API SHALL criar a regra (`201`) com `ticker="POSICAO"` (DEC-22).
2. WHEN o usuário não é membro da usina THEN a API SHALL responder `403` "Usuário não associado a esta usina."
3. WHEN o job avalia a regra THEN ele SHALL usar `politica_hedge.situacao`, a mesma função de `GET /api/posicoes/resumo`, e SHALL NOT buscar preço de mercado para essa regra.
4. WHEN o status é `abaixo` ou `acima` THEN `condicao` SHALL ser verdadeira e a mensagem SHALL dizer o % fixado e a faixa da política.
5. A função `situacao` (em `backend/politica_hedge.py`) SHALL ser pura e coberta por teste; `resumo_safra` já a usa e SHALL continuar passando `test_posicoes.py`.
6. WHEN o job avalia `posicao_limite` e o criador não é mais membro da usina THEN a regra SHALL ser pulada (contada em `puladas`), sem ler nem enviar dados da usina.

**Independent Test**: `pytest backend/tests/test_posicoes.py backend/tests/test_alertas_posicao.py`.

### P1 (rodada 2): Canal Telegram ⭐

**User Story**: Como usuário, quero vincular meu Telegram por um código curto e receber os alertas por lá.

**Acceptance Criteria**:

1. WHEN o usuário chama `POST /api/telegram/codigo` THEN a API SHALL gerar código de 8 caracteres válido por 15 min e devolver `{codigo, expira_em}`. IF o token do bot não está configurado THEN responder `503`.
2. WHEN o Telegram envia `/start CODIGO` com o header `X-Telegram-Bot-Api-Secret-Token` correto e o código não expirou THEN o webhook SHALL gravar `chat_id`, apagar o código e responder `200`, enviando "Pronto. Alertas por Telegram ativados." ao chat.
3. IF o header não confere, ou `TELEGRAM_WEBHOOK_SECRET` não existe THEN o webhook SHALL responder `401` ou `503` e nunca gravar nada.
4. WHEN o código está expirado ou já foi usado THEN o webhook SHALL responder ao chat "Código inválido ou expirado. Gere outro na tela de alertas." e não gravar.
5. WHEN o usuário chama `GET /api/telegram/status` THEN SHALL receber `{disponivel, vinculado}`; `DELETE /api/telegram/vinculo` SHALL remover o `chat_id`.
6. WHEN o job dispara uma regra com `canal=telegram` THEN SHALL enviar pelo `chat_id` do usuário; sem token, grava `erro`, sem quebrar o job.

**Independent Test**: `pytest backend/tests/test_telegram.py` com `requests` simulado.

**Migrations desta rodada:** `20261119000001_preferencias_usuario.sql` (BRF-01), `20261119000002_alertas_posicao_limite.sql` (troca o CHECK de `tipo` para incluir `posicao_limite`), `20261119000003_telegram_vinculos.sql` (RLS: leitura e remoção do próprio vínculo; escrita pelo backend).

**Como registrar o webhook (uma vez, após o deploy)**:
```
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<host-do-backend>/api/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```
Variáveis: `TELEGRAM_BOT_TOKEN` e `TELEGRAM_WEBHOOK_SECRET` (só no backend). Para conferir: `getWebhookInfo` na mesma API.

### P2: Briefing, detalhamento de entrega

- BRF-01 usa `supabase/migrations/20261119000001_preferencias_usuario.sql`.
- BRF-02 usa cron `30 10 * * 1-5` (DEC-24).
- BRF-03 segue DEC-25 a DEC-27.

---

## Edge Cases

- WHEN o ticker não tem dado no intervalo THEN a regra é pulada (DEC-15) e não recebe evento.
- WHEN a regra é apagada no meio da rodada THEN o `unique` e o `on delete cascade` evitam evento órfão; o envio segue só se o evento foi inserido.
- WHEN `posicao_limite` tem política sem produção estimada, ou não há política THEN a regra é pulada (DEC-22) e não recebe evento.
- WHEN `prob_cruzar` tem menos de 60 fechamentos limpos THEN a regra é pulada (DEC-20).
- WHEN o usuário apaga o vínculo do Telegram com regras de canal `telegram` THEN os disparos seguintes seguem a DEC-06 (estado gravado) e gravam evento com `enviado=false` e `erro="Telegram não vinculado"`; não há reenvio por e-mail.
- WHEN `RESEND_API_KEY` não existe THEN o job SHALL não quebrar e os eventos SHALL registrar o erro (DEC-07).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| ALE-01 | P1 Criar e gerir regras (CRUD, limite, 422) | - | Pending |
| ALE-02 | P1 Avaliação pura (3 tipos, paridade de vol) | - | Pending |
| ALE-03 | P1 Disparo na transição (estado, cooldown, unique) | - | Pending |
| ALE-04 | P1 Job agendado e envio (cron, secret, Resend, DEC-07) | - | Pending |
| ALE-05 | P1 Tela de alertas (lista, formulário, testar, histórico, nav) | - | Pending |
| ALE-06 | P1 Segurança dos dados (RLS, filtro por user) | - | Pending |
| BRF-01 | P2 Briefing: opt-in com RLS | - | Pending |
| BRF-02 | P2 Briefing: cron 10:30 UTC e endpoint | - | Pending |
| BRF-03 | P2 Briefing: conteúdo do e-mail | - | Pending |
| ALE-07 | P1 rodada 2: prob_cruzar (avaliador, semente, teste) | - | Pending |
| ALE-08 | P1 rodada 2: posicao_limite (função situacao, criação com membro) | - | Pending |
| ALE-09 | P1 rodada 2: Telegram (código, webhook, envio) | - | Pending |
| MIG | Migrations 20261119000001 (preferencias_usuario), 000002 (tipo posicao_limite no CHECK), 000003 (telegram_vinculos) | - | Pending |

**Coverage:** 12 total, 0 mapeados (Medium).

## Success Criteria

- [ ] Regra de `preco_cruza` criada hoje dispara no e-mail no dia em que o fechamento cruza o nível, e não repete no dia seguinte enquanto a condição continua verdadeira.
- [ ] `pytest backend/tests` passa; `test_calcs.py` e `test_mensagens.py` continuam passando.
- [ ] `npm test`, `npm run lint` e `npm run build` passam no frontend.
