# RAG inicial e consultas de gastos com cartão

O site e o Telegram usam `answerQuestion`, com identidade fechada pela sessão/vínculo. A recuperação lexical usa somente `docs/ajuda/manifest.json`, sem embeddings, dependências, envs ou migrations novas. O build valida e gera o artefato público; requests não percorrem arquivos do projeto. Alterar/excluir fontes exige atualizar o manifesto e publicar outro build.

## Evidência e minimização

- Até três trechos, mil caracteres por trecho e 4096 bytes serializados; o corpo completo enviado ao provedor, incluindo ferramentas/histórico, tem limite de 16000 bytes.
- O corpus ajuda a explicar o produto. Não incrementa `successfulTools` e não comprova valores pessoais. Na produção, a resposta final é montada no servidor com trechos canônicos e DTOs financeiros validados. Prosa livre/números/citações inventados pelo modelo não são aceitos como prova. Sem leitura financeira, a resposta declara que valores pessoais não foram consultados.
- As cinco ferramentas continuam somente de leitura, com schemas estritos e sem argumentos de identidade/SQL/URL. Descrições e notas de lançamentos nunca entram nos DTOs. Categorias fora da allowlist viram rótulos neutros; nomes de contas a vencer também. Perguntas recebem redação complementar de identificadores comuns. Regex não garante anonimização universal de texto livre.
- Não há cache compartilhado de respostas, ferramentas ou chaves. Somente o corpus público compilado é compartilhado. Citações usam IDs/títulos canônicos dos trechos recuperados; não liberam URLs arbitrárias.
- Credenciais permanecem somente na autenticação do provedor. O provedor recebe a pergunta redigida, ajuda pública e agregados/datas/valores necessários. Isso continua sendo envio de dados financeiros pessoais ao provedor escolhido; a entrega não promete anonimato nem ausência de retenção. Telegram também recebe a resposta.

## Correção dos gastos com cartão

A consulta anterior aceitava apenas status `POSTED` (ou manual sem status). Compras recentes de cartão importadas como `PENDING` ficavam de fora, e não havia filtro de tipo de conta. O saldo disponível é deliberadamente diferente de gasto: `get_balance` continua representando dinheiro disponível/investido, sem tratar limite de cartão como saldo.

`get_spending_by_category`, `get_largest_expenses` e `compare_months` aceitam `account_scope: all | credit_card | checking`; o padrão é `all`. Os joins filtram dono da transação **e** da conta. `CREDIT` da Pluggy corresponde à conta local `CREDIT_CARD`; compras são `EXPENSE` com centavos absolutos, enquanto estornos/entradas não são somados como despesas. Transferências e `isCardPayment` permanecem excluídos para não duplicar a compra com o pagamento da fatura.

Compras pendentes de cartão entram como provisórias; pendências de conta corrente e status cancelados continuam excluídos. O período usa `transactions.date`, não `invoiceRef`, fechamento ou vencimento. O importador já ancora a primeira parcela na compra quando há metadado; sem data de compra disponível, usa a data registrada. Parcelas são os valores registrados em suas datas, sem multiplicar ou inferir o total da compra. A consulta não reconstrói dados ausentes nem inicia sincronização.

“Esse fim de semana” usa sábado e domingo mais recentes em `America/Sao_Paulo`, limitado a hoje durante sábado/domingo. “Passado/anterior/último” durante o fim de semana usa o anterior. O servidor fixa esse intervalo e o escopo expresso na pergunta, mesmo se o modelo esquecer. Datas explícitas nos demais pedidos continuam validadas (até 93 dias, sem futuro). O DTO de categorias inclui `totalCents` de todas as categorias, separado dos cinco maiores grupos.

Perguntas de gastos desse fim de semana executam diretamente uma das ferramentas fechadas de despesas no serviço compartilhado (depois das verificações de chave/quota/perfil), sem depender da escolha de ferramenta pelo LLM. Assim a pergunta não pode ser confundida com saldo disponível, que exclui limite de cartão. Nenhuma ação de escrita é iniciada. Pagamentos já classificados como transferência/pagamento de fatura são excluídos; um lançamento importado sem essa classificação precisa ser conciliado no app, sem inferência por coincidência de valor.

## Evidências de teste

- Corpus 1.0.0: 46 chunks. Avaliação sintética de 30 perguntas de ajuda: 30/30 com seção esperada no top3, incluindo as dez regras/FAQ; dez consultas pessoais/mistas verificam valores exatos ou recusa. Medição local Windows: p95 lexical de 3,69 ms em 150 recuperações; não é SLA de produção.
- Provedores Claude/OpenAI/Gemini mockados: ajuda sem leitura, pergunta mista, ferramenta recusada, corpus forjado, citação fora dos IDs recuperados, falha remota e limite do corpo completo. A resposta ignora prosa financeira fabricada mesmo após ferramenta válida.
- Postgres 17 descartável via Docker, porta aleatória somente em loopback, credencial sintética fixa: consultas reais das cinco ferramentas com A/B, conta corrente + cartão, pendências, pagamento/transferência, total além do top5 e concorrência. Relacionamentos inconsistentes testam dono também nos joins. As tabelas de teste reproduzem colunas/defaults sem FKs para permitir esses casos negativos; não executam migrations nem usam URLs do projeto. O container é removido ao fim. Sem Docker, a suíte informa skip; a validação desta entrega exige execução efetiva, sem skip.
- Captura dos corpos de requisições concorrentes do adaptador: nenhum texto de descrição, PII/segredo sintético ou valor do outro dono. Erros usam somente status/códigos fixos. Testes de serviço exercitam a mesma redação/recuperação/escopo para site e Telegram; testes de canais preservam autenticação, vínculo, quotas, comandos e `private, no-store`.

Limites: exemplos sintéticos não homologam os dados da conta real do dono nem medem latência do Google. Compras ausentes na integração não podem aparecer na consulta. A proteção de autorização vem dos schemas e consultas do servidor; prompt e filtros de texto são camadas complementares. Perguntas já em execução usam a identidade capturada no início; desvinculação/remoção é revalidada na próxima requisição, sem promessa de cancelamento retroativo.

Verificação final em 2026-11-16: `npm run verify` passou (1200 testes, incluindo execução efetiva da integração Docker/Postgres, typecheck e build). Nenhuma migration foi aplicada nesta entrega.
