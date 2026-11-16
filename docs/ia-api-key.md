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

`provider` aceita somente `claude`, `openai`, `gemini`. O exemplo é ilustrativo, não uma chave válida. Espaços externos são removidos. Chaves têm até 256 caracteres, apenas letras ASCII, números, `_` e `-`; Claude exige prefixo `sk-ant-` e ao menos 20 caracteres após o prefixo, OpenAI `sk-` e ao menos 20 caracteres após o prefixo (não aceita `sk-ant-`); Gemini aceita de 20 a 256 caracteres desse charset, sem prefixo ou comprimento fixos; a chamada ao provedor confirma a validade. O card inicia com Gemini, conforme a recomendação do guia. Payload máximo: 8 KiB. Campos extras são rejeitados. Os erros Zod nunca são devolvidos, pois podem conter a entrada.

Antes de substituir a chave existente, o servidor realiza uma única geração curta (8 tokens de saída) no modelo do provedor, sem enviar dados financeiros. Essa chamada pode consumir crédito. Falha na validação mantém a configuração anterior. Sucesso retorna o mesmo status seguro de `GET`, com HTTP 200. Nenhuma resposta inclui chave completa ou envelope criptográfico.

`DELETE` não recebe corpo, exige a mesma origem de `PUT`, apaga a linha do usuário e é idempotente. A chave não é revogada no provedor. Perguntas em andamento podem concluir com uma chave já carregada; novas perguntas não a reutilizam. Não há cache de credenciais.

Limites atômicos no Postgres, compartilhados entre instâncias: 60 leituras/minuto por usuário; 5 mutações/minuto por usuário, somando PUT e DELETE. Tentativas inválidas contam. HTTP 429 inclui `Retry-After: 60`. O contador reaproveita `telegram_chat_state` com namespace `ai-key:read|write:<userId>`, sem armazenar chave, corpo ou IP.

Erros têm formato `{ "code": "...", "error": "mensagem em português" }`. A UI deve mostrar `error`, sem registrar corpo do PUT ou enviar a chave à telemetria.

| HTTP | code | Significado |
| --- | --- | --- |
| 400 | `invalid_input` | JSON, tamanho, campos, provedor ou formato inválidos |
| 401 | `unauthorized` | Sessão ausente ou usuário removido |
| 403 | `invalid_origin` | Origem ausente/diferente ou `Sec-Fetch-Site: cross-site` na mutação |
| 415 | `unsupported_media_type` | PUT sem JSON |
| 422 | `invalid_api_key` | Provedor rejeitou a solicitação (400/401/403); conferir chave e acesso ao modelo |
| 422 | `provider_quota` | Provedor retornou 402/429: crédito/cota/limite temporário |
| 429 | `rate_limited` | Limite da própria aplicação |
| 503 | `provider_unavailable` | Timeout, rede, resposta inválida ou outro erro do provedor |
| 503 | `service_unavailable` | Banco, criptografia ou configuração indisponível |

Detalhes, headers e corpos de erros externos nunca são propagados nem registrados. Não há fallback para outro provedor quando a chave pessoal falha.

## Chat do app

`POST /api/chat` continua aceitando `{ "command": "/saldo" }` e o catálogo existente. Para perguntas com chave pessoal:

```json
{"message":"Quais categorias tiveram mais gastos neste mês?"}
```

`message` tem entre 1 e 512 caracteres após trim e não pode começar por `/`. Não combinar `message` e `command` nem enviar identidade. Resposta HTTP 200: `{ "reply": "..." }`. Sem chave pessoal, o caminho `message` responde que a IA está indisponível; os comandos continuam funcionando. O site nunca usa a chave global do servidor para esse novo caminho. Autenticação, origem e limite de 20 requests/minuto existentes permanecem. Erros desse endpoint mantêm o contrato `{error:string}` existente.

## Telegram e ferramentas

O Telegram resolve o dono pelo vínculo verificado no servidor. Perguntas financeiras já reconhecidas priorizam BYOK; sem chave, mantêm o provedor global/comportamento existente. Texto livre que não seja comando nem lançamento reconhecido também usa BYOK se configurado, com resposta local anterior na ausência de chave. O parser determinístico de lançamentos e os comandos existentes continuam separados da IA. O LLM não recebe nenhuma capacidade de escrita.

Os três provedores usam as mesmas cinco ferramentas existentes: saldo, gastos por categoria/período, maiores despesas, comparação de meses e contas a vencer. Consultas fecham a identidade no servidor, validam argumentos com Zod e leem somente o banco. Não fazem sincronização Open Finance, não expõem identidade/conta/descrições privadas e enviam somente os resultados limitados necessários ao provedor escolhido. O aviso existente sobre idade dos dados é preservado nos dois canais.

Modelos: Claude `claude-haiku-5-5`, OpenAI `gpt-4.1-mini`, Gemini `gemini-3.8-flash`. Claude e Gemini reaproveitam os modelos e adapters existentes. OpenAI usa Chat Completions com `store:false`. Referências: [Claude Messages](https://platform.claude.com/docs/en/api/messages/create), [OpenAI GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini), [Gemini API](https://ai.google.dev/gemini-api/docs/models).

As proteções existentes de IA valem também para BYOK: 2 perguntas/minuto, 20/dia por canal/chat; 3 chamadas por pergunta, 4 ferramentas, 500 tokens por resposta, orçamento total de 18 segundos. O chat do site usa o namespace `site:<userId>` para sua cota. Não há histórico persistido. Uma resposta financeira sem ferramenta bem-sucedida é substituída por orientação para consultar dados; erros e respostas são sanitizados. A proteção real contra escrita é a allowlist de ferramentas, não o prompt.

## Criptografia e operação

`user_ai_credentials` guarda provider, envelope AES-256-GCM, últimos quatro caracteres e timestamp. Reutiliza o mecanismo Pluggy em `src/server/open-finance/crypto.ts`, com `APP_ENCRYPTION_KEY` em base64 canônico de 32 bytes e AAD `<userId>:ai-api-key:<provider>`. Isso impede transplantar envelopes entre usuários/provedores. DELETE não depende de descriptografia e funciona mesmo se a chave mestra estiver indisponível.

A migration está **somente** em `drizzle/pending/user-ai-credentials.sql`, sem aplicação nem alteração de journal/snapshots. Revisar e aplicar manualmente antes de disponibilizar o recurso. Sem essa tabela, endpoints de configuração e IA falham fechado; a leitura da credencial não deve ser tratada como ausência de chave. Trocar `APP_ENCRYPTION_KEY` sem recriptografar envelopes invalida as chaves armazenadas, como já ocorre com Pluggy.

Riscos operacionais: o provedor recebe a pergunta sanitizada e dados financeiros limitados quando ferramentas são consultadas; o usuário deve compreender esse envio e os custos na própria conta. Não registrar payloads/headers em proxies, APM, analytics ou logs de requisição. Remover a chave do app não a apaga de backups antigos nem a revoga no provedor. Modelos e permissões podem mudar; a validação pode detectar indisponibilidade ou falta de acesso, sem garantir saldo futuro. Testes locais simulam provedores e persistência; chamadas reais com chaves pessoais e a migration de produção exigem validação no ambiente autorizado.
