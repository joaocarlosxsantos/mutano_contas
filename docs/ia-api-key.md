# Chave pessoal de IA (BYOK)

Uma credencial ativa por usuário, independente do vínculo Telegram. Não há dependências novas. A UI fica na aba Minha conta; este contrato não implementa componentes.

## API da conta

`GET`, `PUT` e `DELETE /api/usuario/ia-api-key` exigem sessão autenticada de um usuário existente. A identidade vem exclusivamente da sessão; não aceitar `userId` no cliente. Respostas usam `Cache-Control: private, no-store, max-age=0`, `Vary: Cookie` e `X-Content-Type-Options: nosniff`.

`GET` retorna HTTP 200 com apenas:

```json
{"configured":true,"provider":"openai","last4":"1234"}
```

Sem chave (também a resposta de `DELETE`):

```json
{"configured":false,"provider":null,"last4":null}
```

`PUT` exige `Content-Type: application/json`, `Origin` igual à origem do request e corpo estrito:

```json
{"provider":"openai","apiKey":"sk-proj-CHAVE_PESSOAL"}
```

`provider` aceita somente `claude`, `openai`, `gemini`. O exemplo é ilustrativo, não uma chave válida. Espaços externos são removidos. Chaves têm até 256 caracteres. O charset base aceita letras ASCII, números e `_`, `-`, `.`, `~`, `+`, `/`, `=`; Claude e OpenAI continuam restritos a letras ASCII, números, `_` e `-`. Claude exige prefixo `sk-ant-` e ao menos 20 caracteres após o prefixo, OpenAI `sk-` e ao menos 20 caracteres após o prefixo (não aceita `sk-ant-`); Gemini aceita de 20 a 256 caracteres desse charset, sem prefixo ou comprimento fixos; tokens como `AIza...` e `AQ.` são aceitos; a chamada ao provedor confirma a validade. O card inicia com Gemini, conforme a recomendação do guia. Payload máximo: 8 KiB. Campos extras são rejeitados. Os erros Zod nunca são devolvidos, pois podem conter a entrada.

Antes de substituir a chave existente, o Gemini faz somente `GET https://generativelanguage.googleapis.com/v1beta/models?pageSize=1`, com a chave no header `x-goog-api-key` e timeout de 10 segundos. HTTP 200 valida a autenticação; a resposta é cancelada sem consumir a listagem. Não há geração de texto, thinking ou custo de inferência nessa validação. Listar modelos **não comprova** que o modelo do chat esteja disponível para a conta ou consiga gerar respostas: acesso, cota e disponibilidade ainda podem falhar no chat. Claude/OpenAI mantêm a chamada de geração curta de 8 tokens e timeout de 15 segundos, pois a alternativa via listagem não foi homologada com chaves válidas desses provedores. Essas gerações podem consumir crédito. Nenhum fluxo envia dados financeiros na validação. Falha mantém a configuração anterior. Sucesso retorna o mesmo status seguro de `GET`, com HTTP 200. Nenhuma resposta inclui chave completa ou envelope criptográfico.

`DELETE` não recebe corpo, exige a mesma origem de `PUT`, apaga a linha do usuário e é idempotente. A chave não é revogada no provedor. Perguntas em andamento podem concluir com uma chave já carregada; novas perguntas não a reutilizam. Não há cache de credenciais.

Limites atômicos no Postgres, compartilhados entre instâncias: 60 leituras/minuto por usuário; 5 mutações/minuto por usuário, somando PUT e DELETE. Tentativas inválidas contam. HTTP 429 inclui `Retry-After: 60`. O contador reaproveita `telegram_chat_state` com namespace `ai-key:read|write:<userId>`, sem armazenar chave, corpo ou IP.

Erros têm formato `{ "code": "...", "error": "mensagem em português" }`. A UI deve mostrar `error`, sem registrar corpo do PUT ou enviar a chave à telemetria.

| HTTP | code | Significado |
| --- | --- | --- |
| 400 | `invalid_input` | Mensagem identifica `provider` inválido, tamanho/tipo/formato de `apiKey`, campos extras ou JSON inválido; nunca inclui a entrada |
| 401 | `unauthorized` | Sessão ausente ou usuário removido |
| 403 | `invalid_origin` | Origem ausente/diferente ou `Sec-Fetch-Site: cross-site` na mutação |
| 415 | `unsupported_media_type` | PUT sem JSON |
| 422 | `invalid_api_key` | Provedor rejeitou a solicitação (400/401/403); conferir chave e acesso ao modelo |
| 422 | `provider_quota` | Provedor retornou 402/429: crédito/cota/limite temporário |
| 429 | `rate_limited` | Limite da própria aplicação |
| 502 | `provider_model_unavailable` | HTTP 404 externo na validação de geração Claude/OpenAI: modelo configurado indisponível |
| 502 | `provider_request_rejected` | Parâmetros/configuração rejeitados; inclui HTTP 400 Gemini sem código estruturado de chave inválida |
| 502 | `provider_invalid_response` | JSON, corpo ou estrutura de resposta inválidos |
| 503 | `provider_unavailable` | Somente rede, timeout (inclui HTTP 408) ou HTTP 5xx externo |
| 503 | `service_unavailable` | Banco, criptografia ou configuração indisponível |

Erros de validação remota acrescentam apenas `providerStatus` (status HTTP externo ou null sem resposta) e `reason` (enum estático: `invalid_api_key`, `quota`, `model_unavailable`, `request_rejected`, `invalid_response`, `timeout`, `network`, `upstream_error`). A mensagem `error` explica o motivo em português. O log do servidor contém somente status/code, sem payload, headers, mensagens do provedor ou chave. Não há fallback para outro provedor quando a chave pessoal falha.

Verificação histórica em 16/11/2026: o modelo anterior do chat era `gemini-3.8-flash`, conforme [documentação oficial](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), com [autenticação via `x-goog-api-key`](https://ai.google.dev/gemini-api/docs/api-key). A validação Gemini usa apenas ListModels, independente do endpoint de geração do chat definido em `src/server/telegram/gemini.ts`; `AI_MODEL` é a constante Claude, não uma variável Gemini. A função corrigida, contra ListModels real com chave exclusivamente falsa, retornou `invalid_api_key`/400 em 306 ms (detalhe externo `API_KEY_INVALID`), sem 503. Essa medição não é garantia de latência: rede, cold start e banco podem elevar o tempo total do salvamento. Nenhuma chave válida real foi usada, e o teste com chave falsa não comprova acesso ao modelo do chat.

## Chat do app

`POST /api/chat` continua aceitando `{ "command": "/saldo" }` e o catálogo existente. Para perguntas com chave pessoal:

```json
{"message":"Quais categorias tiveram mais gastos neste mês?"}
```

`message` tem entre 1 e 512 caracteres após trim e não pode começar por `/`. Não combinar `message` e `command` nem enviar identidade. Resposta HTTP 200: `{ "reply": "..." }`. Sem chave pessoal, o caminho `message` responde que a IA está indisponível; os comandos continuam funcionando. O site nunca usa a chave global do servidor para esse novo caminho. Autenticação, origem e limite de 20 requests/minuto existentes permanecem. Erros desse endpoint mantêm o contrato `{error:string}` existente.

## Telegram e ferramentas

O Telegram resolve o dono pelo vínculo verificado no servidor. Perguntas financeiras já reconhecidas priorizam BYOK; sem chave, mantêm o provedor global/comportamento existente. Texto livre que não seja comando nem lançamento reconhecido também usa BYOK se configurado, com resposta local anterior na ausência de chave. O parser determinístico de lançamentos e os comandos existentes continuam separados da IA. O LLM não recebe nenhuma capacidade de escrita.

Os três provedores usam as mesmas cinco ferramentas existentes: saldo, gastos por categoria/período, maiores despesas, comparação de meses e contas a vencer. Consultas fecham a identidade no servidor, validam argumentos com Zod e leem somente o banco. Não fazem sincronização Open Finance, não expõem identidade/conta/descrições privadas e enviam somente os resultados limitados necessários ao provedor escolhido. O aviso existente sobre idade dos dados é preservado nos dois canais.

Modelos: Claude `claude-haiku-5-5`, OpenAI `gpt-4.1-mini`, Gemini `gemini-3.5-flash-lite`. A configuração Gemini fica em uma única constante `GEMINI_CONFIG` em `src/server/telegram/gemini.ts`: modelo estável Flash-Lite, thinking MINIMAL, 1024 tokens incluindo thinking. OpenAI usa Chat Completions com `store:false`. Referências: [Claude Messages](https://platform.claude.com/docs/en/api/messages/create), [OpenAI GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [Gemini Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite).

As proteções existentes de IA valem também para BYOK: 2 perguntas/minuto, 20/dia por canal/chat; 3 chamadas por pergunta e 4 ferramentas. Claude/OpenAI mantêm 500 tokens de saída. Gemini usa 1024 tokens incluindo thinking MINIMAL, sem exibir pensamentos. A resposta visível de IA continua limitada a 1800 caracteres e passa por sanitização. O orçamento é de 18 segundos no site e em Claude/OpenAI; Gemini no Telegram dispõe de 40 segundos. O chat do site usa o namespace `site:<userId>` para sua cota. Não há histórico persistido. Uma resposta financeira sem ferramenta bem-sucedida é substituída por orientação para consultar dados. A proteção real contra escrita é a allowlist de ferramentas, não o prompt.

### Latência de geração Gemini

O log de produção `gemini_timeout` com status null confirma que a chamada de geração não entregou headers dentro do orçamento total de 40 segundos. Não indica falha de autenticação da listagem e não prova que o modelo inexiste. O desenvolvimento não tem `GEMINI_API_KEY`/`GOOGLE_API_KEY`; por isso não foi possível listar modelos por conta nem medir latência autenticada, comparar tools/thinking ou comprovar melhora abaixo de 10 segundos. Não foi usada a credencial do dono.

O adapter agora usa `streamGenerateContent?alt=sse`, mesma allowlist de ferramentas e header de autenticação. Um único AbortSignal cobre fetch, leitura do stream e ferramentas em todas as rodadas; não há timeout separado de validação de 10/15s no chat. O parser limita bytes/eventos/partes, preserva assinaturas e cancela o reader ao receber finishReason ou abortar. Timeout após receber headers registra `gemini_body_timeout` e status HTTP; antes dos headers, `gemini_timeout`/null. Nenhum conteúdo é registrado. Streaming permite receber antes, mas não garante inferência mais rápida nem envia resposta parcial não validada ao usuário.

`gemini-3.5-flash-lite`/MINIMAL foi escolhido pela [documentação de baixa latência](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) e [níveis suportados](https://ai.google.dev/gemini-api/docs/generate-content/thinking), não por benchmark autenticado. `thinkingBudget:0` não é válido como thinking-off em 3.x. O modelo anterior `gemini-3.8-flash` não aceita MINIMAL. Não há fallback silencioso de modelo/provedor. Acesso por conta precisa ser confirmado com ListModels e geração de teste.

Para benchmark autorizado com chave de desenvolvimento já no ambiente: `node --env-file=.env scripts/probe-gemini.mjs`. O script consulta só nomes/métodos dos candidatos, compara generateContent/streamGenerateContent com/sem uma ferramenta sintética e níveis suportados. Registra somente modelo/configuração, status/code e latências de headers/primeiro chunk/fim; não imprime chave, payload, conteúdo gerado ou erro externo. Ausência de chave retorna `development_key_missing` sem chamadas; não busca BYOK nem altera env. Gerações desse teste podem consumir cota/crédito da chave de desenvolvimento.

Texto livre do Telegram recebe ACK imediato e roda em `after()` do Next, com `maxDuration=60`. O processador tem limite total de 50 segundos, reservando tempo para enviar a resposta/falha amigável por `sendMessage`. Comandos de barra continuam no caminho síncrono. Falhas da IA registram somente status/code fixos (HTTP, timeout, resposta inválida, lookup de credencial/perfil), sem pergunta, identidade, chave, headers ou payload externo. O adapter Gemini aceita `functionCall.id` opcional, atribui IDs internos por rodada quando necessário e devolve `functionResponse` sem inventar ID externo, preservando assinaturas opacas. Referências: [after](https://nextjs.org/docs/app/api-reference/functions/after), [function calling Gemini](https://ai.google.dev/api/generate-content), [thinking Gemini](https://ai.google.dev/gemini-api/docs/thinking).

## Segredos nos chats

Mensagens contendo padrões de chave `AIza...`, `AQ....`, `sk-...`, `sk-ant-...` ou Bearer são bloqueadas no site e no Telegram antes de parser de lançamentos, lookup de credencial e LLM. O conteúdo não é persistido como lançamento, enviado ao provedor nem registrado em logs. O aviso orienta usar Minha conta e revogar/rotacionar uma chave que tenha sido exposta. A detecção é repetida no serviço de IA e no adapter como defesa adicional; saídas, labels financeiros e resultados de ferramentas também têm esses padrões removidos. A rota HTTP nunca repete o token.

No Telegram, a proteção valida chat privado e remetente antes de tentar `deleteMessage`, enviando somente chat_id/message_id ao Telegram. `message_id` é opcional para compatibilidade; sem ele, sem permissão, com mensagem antiga ou falha de rede, a remoção é best effort e o aviso permanece. A mensagem secreta é substituída pelo aviso antes do processamento/validação de tamanho, inclusive quando excede 512 caracteres (respeitado o limite de corpo do webhook). A exclusão não garante remoção de cópias, encaminhamentos ou backups; uma chave já exposta precisa ser revogada no provedor. Nunca é solicitado o valor real para investigar. [Limitações de deleteMessage](https://core.telegram.org/bots/api#deletemessage).

## Criptografia e operação

`user_ai_credentials` guarda provider, envelope AES-256-GCM, últimos quatro caracteres e timestamp. Reutiliza o mecanismo Pluggy em `src/server/open-finance/crypto.ts`, com `APP_ENCRYPTION_KEY` em base64 canônico de 32 bytes e AAD `<userId>:ai-api-key:<provider>`. Isso impede transplantar envelopes entre usuários/provedores. DELETE não depende de descriptografia e funciona mesmo se a chave mestra estiver indisponível.

A migration está **somente** em `drizzle/pending/user-ai-credentials.sql`, sem aplicação nem alteração de journal/snapshots. Revisar e aplicar manualmente antes de disponibilizar o recurso. Sem essa tabela, endpoints de configuração e IA falham fechado; a leitura da credencial não deve ser tratada como ausência de chave. Trocar `APP_ENCRYPTION_KEY` sem recriptografar envelopes invalida as chaves armazenadas, como já ocorre com Pluggy.

Riscos operacionais: o provedor recebe a pergunta sanitizada e dados financeiros limitados quando ferramentas são consultadas; o usuário deve compreender esse envio e os custos na própria conta. Não registrar payloads/headers em proxies, APM, analytics ou logs de requisição. Remover a chave do app não a apaga de backups antigos nem a revoga no provedor. Modelos e permissões podem mudar; a validação pode detectar indisponibilidade ou falta de acesso, sem garantir saldo futuro. Testes locais simulam provedores e persistência; chamadas reais com chaves pessoais e a migration de produção exigem validação no ambiente autorizado.
