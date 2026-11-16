# Guias de uso

Conteúdo editorial público do produto. Versão `1.0.0`; revisão em `2026-11-16`; responsável: Produto. Os campos `route_key` identificam telas sem criar links internos. Cada bloco é uma unidade de ajuda; os exemplos não contêm dados de clientes.

## Painel — resumo do mês

- **id:** `painel`
- **aliases:** início, página inicial, dashboard, resumo, saldo do mês, visão geral
- **route_key:** `painel`
- **perfis:** `integracao_total`, `hibrido`, `manual`
- **versao:** 1.0.0
- **data_revisao:** 2026-11-16
- **responsavel:** Produto

### Passos

1. Abra **Painel** na navegação. O cabeçalho resume entradas, saídas e saldo do mês selecionado.
2. Consulte o ritmo de gastos, a previsão de fechamento e os alertas disponíveis.
3. Role a página para ver o histórico dos últimos seis meses, categorias com mais gastos, faturas, planejamento e progresso da reserva.
4. Se houver conexão bancária, use a ação de sincronização exibida para atualizar os dados integrados.

### FAQ

- **Por que o saldo está parcial?** Uma conta integrada pode ainda não ter um saldo bancário atualizado; confira o estado da conexão e sincronize.
- **Aplicações entram em “Entrou” ou “Saiu”?** A posição investida aparece separadamente; aporte e resgate não são receita ou despesa. Impostos de investimento contam como despesa.

## Insights — alertas e observações

- **id:** `insights`
- **aliases:** insight, alertas, avisos financeiros, análise do mês
- **route_key:** `insights`
- **perfis:** `integracao_total`, `hibrido`, `manual`
- **versao:** 1.0.0
- **data_revisao:** 2026-11-16
- **responsavel:** Produto

### Passos

1. Abra **Insights** na navegação.
2. Leia os avisos gerados a partir dos dados disponíveis, como vencimentos, orçamento e previsão de saldo.
3. Se a tela não mostrar itens, confira se há movimentações no mês atual ou anterior e se as contas estão atualizadas.

### FAQ

- **A ausência de insight significa que não há risco?** Não necessariamente. A tela pode não ter dados suficientes para gerar uma observação.
- **O insight altera meus lançamentos?** Não. Ele apresenta informação para consulta.

## Lançamentos — entradas, despesas, parcelas e divisões

- **id:** `lancamentos`
- **aliases:** transações, movimentações, receitas, despesas, entradas, saídas, parcelas, dividir despesa, a receber
- **route_key:** `lancamentos`
- **perfis:** `integracao_total`, `hibrido`, `manual`
- **versao:** 1.0.0
- **data_revisao:** 2026-11-16
- **responsavel:** Produto

### Passos

1. Abra **Lançamentos** para consultar movimentações; use filtros de período, conta ou categoria para localizar itens.
2. Nos perfis **Híbrido** e **Somente manual**, escolha **Novo lançamento**, marque se o valor entrou ou saiu e informe descrição, valor, data, categoria e conta.
3. Para uma despesa parcelada, escolha o número de parcelas. O formulário mostra a divisão mensal do total antes de salvar.
4. Para dividir uma despesa existente, abra a ação de divisão do item e informe as pessoas e a parte de cada uma; é possível distribuir igualmente, por percentual ou por valor.
5. Use **Nova transferência** para mover dinheiro entre contas suas. Na lista geral, o par aparece como uma transferência entre origem e destino; excluir a transferência remove as duas pernas.
6. Consulte **A receber** para acompanhar as partes de despesas divididas e valores relacionados a contas.

### FAQ

- **Por que uma compra de cartão não aparece em “Saiu”?** Compras no cartão são demonstradas separadamente; a saída da conta ocorre quando a fatura é paga.
- **Posso lançar manualmente no perfil Integração total?** Não pela tela de lançamentos. Esse perfil prioriza movimentações vindas de contas integradas.

## Contas, cartões e faturas

- **id:** `contas-cartoes`
- **aliases:** saldos, conta corrente, carteira, cartão, cartão de crédito, fatura, fechamento, vencimento
- **route_key:** `contas`
- **perfis:** `integracao_total`, `hibrido`, `manual`
- **versao:** 1.0.0
- **data_revisao:** 2026-11-16
- **responsavel:** Produto

### Passos

1. Abra **Contas e saldos** para comparar o saldo de cada conta e o patrimônio líquido.
2. Para criar uma conta manual (nos perfis que permitem), escolha **Criar conta**, dê um nome e selecione o tipo.
3. Ao criar cartão de crédito, informe também os dias de fechamento e vencimento para organizar as compras e faturas.
4. Abra o cartão ou a seção de faturas para consultar as compras atribuídas ao período. Compras podem ser à vista ou parceladas.
5. Se uma conta integrada mostrar saldo indisponível ou parcial, confira a conexão e a última atualização; não trate dado ausente como saldo zero.

### FAQ

- **Qual a diferença entre fechamento e vencimento?** Fechamento define o ciclo que reúne compras; vencimento é a data de pagamento da fatura.
- **Por que o patrimônio líquido pode estar incompleto?** Pode faltar saldo atualizado de uma conta integrada.

## Categorias — organizar receitas e despesas

- **id:** `categorias`
- **aliases:** tipo de gasto, natureza, classificação, palavras-chave, categoria de transação
- **route_key:** `configuracoes`
- **perfis:** `integracao_total`, `hibrido`, `manual`
- **versao:** 1.0.0
- **data_revisao:** 2026-11-16
- **responsavel:** Produto

### Passos

1. Abra **Configurações** e localize **Categorias**.
2. Para criar uma, escolha **Nova categoria**, informe nome, tipo (entrada ou saída), natureza e cor; palavras-chave são opcionais.
3. Separe palavras-chave por vírgula. Elas ajudam a sugerir categorias durante a importação.
4. Use a ação de edição para ajustar uma categoria existente ou arquive-a quando não quiser mais usá-la.
5. Na tela de lançamentos, um item sem categoria pode ser classificado diretamente pela lista.

### FAQ

- **O que acontece se eu remover uma palavra-chave?** Deixa de ser usada como dica em novas classificações; revise as sugestões na importação.
- **Categoria sem limite entra no orçamento?** Não; o orçamento acompanha somente categorias com limite definido.

## Contas a pagar e despesas compartilhadas

- **id:** `contas-a-pagar`
- **aliases:** despesas a vencer, contas, rateio, grupo, contas compartilhadas, acerto, valor a receber
- **route_key:** `contas-a-pagar`
- **perfis:** `integracao_total`, `hibrido`, `manual`
- **versao:** 1.0.0
- **data_revisao:** 2026-11-16
- **responsavel:** Produto

### Passos

1. Abra **Contas a pagar** e escolha a aba adequada para contas individuais ou compartilhadas.
2. Em **Nova conta**, informe descrição, valor e vencimento; uma conta pode ser avulsa ou recorrente.
3. Para dividir uma despesa, selecione **Em grupo (dividir)**, escolha as pessoas e distribua os valores. A divisão inicial pode ser igual e pode ser ajustada.
4. Use **Grupos e acertos** para cadastrar pessoas que compartilham despesas e consultar saldos entre participantes.
5. Marque os pagamentos na lista; em contas compartilhadas, o pagamento de cada participante pode ser acompanhado individualmente.

### FAQ

- **Onde vejo o que falta receber?** Na visualização de contas compartilhadas, confira o resumo de valores pendentes e recebidos por pessoa.
- **Editar o rateio pode deixar diferença?** A tela sinaliza quando falta distribuir ou quando a soma ultrapassa o total.

## Orçamento — limites por categoria

- **id:** `orcamento`
- **aliases:** limite mensal, gastos por categoria, consumo, estouro, orçamento mensal
- **route_key:** `orcamento`
- **perfis:** `integracao_total`, `hibrido`, `manual`
- **versao:** 1.0.0
- **data_revisao:** 2026-11-16
- **responsavel:** Produto

### Passos

1. Abra **Orçamento** e selecione o mês que quer acompanhar.
2. Se ainda não houver limites, use **Sugerir ou copiar limites**: as sugestões usam o histórico disponível e copiar traz limites do mês anterior.
3. Edite o valor de uma categoria diretamente na lista; zerar o campo remove o limite.
4. Acompanhe os estados: até 79% do limite está no ritmo; de 80% a 100% pede atenção; acima de 100% indica estouro.
5. Confira também o resumo do mês e as categorias que tiveram gasto sem limite.

### FAQ

- **Gasto sem limite entra no total acompanhado?** Não. Defina um limite para incluí-lo no acompanhamento do orçamento.
- **Posso aplicar uma sugestão sobre um limite existente?** Sim; o app pede confirmação antes de substituir o valor atual.

## Metas e reserva de emergência

- **id:** `metas-reserva`
- **aliases:** objetivo, juntar dinheiro, reserva, colchão de segurança, aporte, resgate
- **route_key:** `metas`
- **perfis:** `integracao_total`, `hibrido`, `manual`
- **versao:** 1.0.0
- **data_revisao:** 2026-11-16
- **responsavel:** Produto

### Passos

1. Abra **Metas e reserva** para ver a estimativa da reserva e o progresso das metas.
2. Para criar uma meta, informe nome, valor desejado e, se quiser, prazo e observação.
3. Em uma meta, escolha **Registrar aporte** para adicionar dinheiro guardado ou **Resgatar** para retirar parte do valor.
4. Consulte quanto falta e a estimativa de tempo no ritmo atual. A capacidade mensal é uma estimativa baseada nos dados disponíveis.
5. Se precisar, configure um aporte automático recorrente e acompanhe se o aporte do mês já foi registrado.

### FAQ

- **O investimento é somado automaticamente às metas?** Não. Saldo investido e valores guardados em metas são acompanhados separadamente.
- **Como a reserva é estimada?** A tela considera meses de reserva e renda/custo disponível; com movimentações, pode usar o custo real observado.

## Lançamentos recorrentes

- **id:** `recorrentes`
- **aliases:** recorrência, assinatura, despesa fixa, receita fixa, cobrança mensal, reajuste
- **route_key:** `recorrentes`
- **perfis:** `hibrido`, `manual`
- **versao:** 1.0.0
- **data_revisao:** 2026-11-16
- **responsavel:** Produto

### Passos

1. Abra **Lançamentos recorrentes** para consultar compromissos e receitas que se repetem.
2. Use **Preencher recorrência** para informar descrição, valor, conta e categoria, e configure a regra mensal.
3. Confira a lista de itens pendentes do mês e gere os lançamentos que deseja registrar.
4. Pause uma regra para interromper novas gerações sem apagar lançamentos anteriores; retome quando necessário.
5. Revise o compromisso mensal e os avisos de aumento de preço.

### FAQ

- **Pausar apaga o histórico?** Não. A pausa interrompe a geração futura e preserva os lançamentos já criados.
- **Por que não encontro a tela?** Recorrentes não é exibida no perfil Integração total.

## Projeções — simular cenários

- **id:** `projecoes`
- **aliases:** juros compostos, simulador, projeção patrimonial, rentabilidade, aportes mensais
- **route_key:** `projecoes`
- **perfis:** `integracao_total`, `hibrido`, `manual`
- **versao:** 1.0.0
- **data_revisao:** 2026-11-16
- **responsavel:** Produto

### Passos

1. Abra **Projeções** e confira o saldo inicial usado na simulação.
2. Ajuste saldo inicial, aporte mensal e horizonte em anos nos controles da tela.
3. Compare os três cenários de rentabilidade anual e veja quanto veio dos aportes e quanto veio dos juros.
4. Se o saldo investido estiver parcial, complete a atualização das contas ou ajuste o saldo inicial para explorar cenários.

### FAQ

- **A projeção garante esse resultado?** Não. É uma simulação de cenários, não uma promessa de rendimento.
- **O valor guardado em metas é sempre somado ao saldo investido?** A tela explica quando usa o valor guardado em metas como referência por falta de saldo de investimento completo; confira o aviso exibido.

## Dívidas — cadastro e plano de quitação

- **id:** `dividas`
- **aliases:** saldo devedor, juros, dívida, quitar, avalanche, bola de neve, pagamento mínimo
- **route_key:** `dividas`
- **perfis:** `integracao_total`, `hibrido`, `manual`
- **versao:** 1.0.0
- **data_revisao:** 2026-11-16
- **responsavel:** Produto

### Passos

1. Abra **Dívidas** e cadastre cada dívida com saldo devedor, juros mensais e pagamento mínimo.
2. Revise o total devido, o custo mensal dos juros e o valor comprometido com mínimos.
3. Use o planejador para comparar **Avalanche** (prioriza juros maiores) e **Bola de neve** (prioriza saldos menores).
4. Abra a dívida e use **Registrar pagamento** para atualizar o saldo após pagar.
5. Corrija os dados quando saldo, juros ou mínimo mudarem; a ordem e a estimativa dependem dessas informações.

### FAQ

- **O que significam os métodos?** Avalanche prioriza a taxa mais alta para reduzir juros; bola de neve prioriza quitar primeiro a dívida menor.
- **A data projetada é garantida?** Não; é uma estimativa que depende dos saldos, taxas e pagamentos informados.

## Importar extrato ou fatura

- **id:** `importar`
- **aliases:** importar transações, CSV, OFX, extrato bancário, importar cartão, importar fatura
- **route_key:** `importar`
- **perfis:** `hibrido`, `manual`
- **versao:** 1.0.0
- **data_revisao:** 2026-11-16
- **responsavel:** Produto

### Passos

1. Exporte o arquivo CSV ou OFX no banco e abra **Importar extrato ou fatura**.
2. Escolha a conta correspondente e selecione o arquivo. Para uma fatura, selecione uma conta de cartão e informe o mês de referência.
3. Revise a prévia: confira data, descrição, valor, categoria sugerida e quais linhas estão selecionadas.
4. Ajuste o que precisar e escolha **Importar**. A tela avisa sobre registros possivelmente repetidos.
5. Consulte **Importações recentes**. Se um lote foi importado errado, use a ação de apagar o lote antes de importar novamente.

### FAQ

- **O que é necessário para importar fatura?** Uma conta de cartão cadastrada e o mês de referência da fatura.
- **Por que a tela está oculta?** Importação manual não está disponível no perfil Integração total.

## Open Finance e Pluggy

- **id:** `open-finance`
- **aliases:** conectar banco, conexão bancária, Pluggy, sincronização, atualizar saldo, Open Finance
- **route_key:** `configuracoes-integracao`
- **perfis:** `integracao_total`, `hibrido`
- **versao:** 1.0.0
- **data_revisao:** 2026-11-16
- **responsavel:** Produto

### Passos

1. Abra **Configurações** e escolha **Open Finance** ou **Conexões**.
2. Configure as credenciais da aplicação Pluggy se você tiver acesso a elas; o sistema valida antes de habilitar conexões.
3. Escolha **Conectar conta** e conclua a autorização no painel seguro Pluggy Connect do seu banco.
4. Associe cada conta encontrada a uma conta local. Para cartão, crie primeiro uma conta local do tipo cartão de crédito se ainda não houver.
5. Use **Sincronizar agora** e confira o resultado por conta e o horário da última leitura.
6. Se desconectar, leia a confirmação: é possível manter lançamentos importados ou removê-los, conforme a opção escolhida.

### FAQ

- **Somente manual pode conectar banco?** Não. Open Finance fica desativado nesse perfil.
- **A sincronização atualiza o banco em tempo real?** Ela lê dados disponíveis na conexão; a tela informa o horário da última atualização e pode mostrar dados parciais.
- **Remover a conexão apaga lançamentos?** A confirmação apresenta as opções de manter o histórico ou excluir os dados importados.

## Minha conta e chave de IA

- **id:** `minha-conta-ia`
- **aliases:** perfil de uso, renda, chave de API, API key, Gemini, Claude, OpenAI, provedor de IA
- **route_key:** `usuario`
- **perfis:** `integracao_total`, `hibrido`, `manual`
- **versao:** 1.0.0
- **data_revisao:** 2026-11-16
- **responsavel:** Produto

### Passos

1. Abra o menu do usuário e entre em **Minha conta**.
2. Ajuste o perfil de uso, renda mensal, meses de reserva e percentual que pretende guardar.
3. No card **Assistente de IA**, escolha Gemini, Claude ou OpenAI, cole a chave e salve. A chave é validada antes de substituir uma configuração existente.
4. Depois de salvar, somente o provedor e os últimos quatro caracteres são mostrados; a chave completa não pode ser consultada novamente.
5. Para trocar, informe uma nova chave. Para desconectar, escolha **Remover** e confirme.

### FAQ

- **A chave é obrigatória para usar o app?** Não. Ela serve para perguntas livres ao assistente de IA; os demais recursos do app continuam separados.
- **Onde ficam os passos para gerar uma chave?** No próprio card, em **Como obter sua chave**.
- **Por que o card pode dizer que está indisponível?** A configuração depende de armazenamento seguro estar disponível; tente novamente mais tarde.
- **O provedor recebe meus dados?** A pergunta e os dados financeiros mínimos necessários às consultas podem ser enviados ao provedor escolhido. Confira os avisos apresentados antes de usar.

## Configurações gerais, categorias e backup

- **id:** `configuracoes`
- **aliases:** preferências, perfil financeiro, dados da conta, backup, exportar dados, categorias
- **route_key:** `configuracoes`
- **perfis:** `integracao_total`, `hibrido`, `manual`
- **versao:** 1.0.0
- **data_revisao:** 2026-11-16
- **responsavel:** Produto

### Passos

1. Abra **Configurações** para editar perfil financeiro, contas, categorias e opções de integração ou Telegram.
2. Para exportar seus dados, localize **Dados** e escolha **Baixar backup (JSON)**.
3. Confirme sua senha quando solicitado para autorizar o download do arquivo.
4. Guarde o arquivo de backup em local seguro; ele contém dados da sua conta.

### FAQ

- **O backup é planilha?** Não. O download é um arquivo JSON.
- **Onde altero as preferências de perfil e renda?** Na página **Minha conta**.

## Telegram, bot e comandos

- **id:** `telegram`
- **aliases:** bot, Telegram, vincular bot, avisos do Telegram, /saldo, /cartao, /resumo
- **route_key:** `configuracoes`
- **perfis:** `integracao_total`, `hibrido`, `manual`
- **versao:** 1.0.0
- **data_revisao:** 2026-11-16
- **responsavel:** Produto

### Passos

1. Em **Configurações**, localize o card **Telegram** e escolha **Gerar link do Telegram**.
2. Abra o link e conclua a vinculação em uma conversa privada. O link é temporário e de uso único; não o compartilhe.
3. Use os comandos publicados pelo bot: `/saldo`, `/previsao`, `/hoje`, `/assinaturas`, `/resumo`, `/relatorio`, `/cartao`, `/start`, `/menu`, `/ajuda` e `/pausar`.
4. Para perguntas livres em linguagem natural, configure a chave pessoal de IA em **Minha conta**. O bot responde consultas; não cria nem edita lançamentos por pedido de texto.
5. Configure os avisos e horários na seção de preferências do Telegram; para encerrar o vínculo, escolha **Desconectar Telegram**.

### FAQ

- **Posso enviar comandos em um grupo?** Use uma conversa privada vinculada para consultar sua conta.
- **O comando `/pausar` desconecta o bot?** Não. Ele pausa avisos automáticos; consultas continuam disponíveis.
- **A chave pessoal muda os comandos?** Não. Ela habilita o caminho de perguntas livres; comandos publicados permanecem separados.

## Notificações — avisos e push

- **id:** `notificacoes`
- **aliases:** avisos, alerta, push, notificações do celular, vencimento, orçamento
- **route_key:** `notificacoes`
- **perfis:** `integracao_total`, `hibrido`, `manual`
- **versao:** 1.0.0
- **data_revisao:** 2026-11-16
- **responsavel:** Produto

### Passos

1. Abra **Notificações** para ler avisos recebidos no app.
2. Em **Preferências de notificações**, escolha os assuntos e canais que deseja receber e salve.
3. Para receber Web Push neste navegador/dispositivo, escolha **Ativar push neste dispositivo** e autorize quando o navegador pedir.
4. Para remover o push, volte à mesma área e escolha **Remover push deste dispositivo**.
5. O canal Telegram exige que o bot esteja vinculado; suas preferências são configuradas em **Configurações**.

### FAQ

- **Ativar push em um aparelho ativa nos outros?** Não. A inscrição é específica deste dispositivo/navegador.
- **Quais avisos posso ajustar?** A tela apresenta assuntos como contas a pagar, faturas, orçamento, saldo/previsão, metas e sincronização.
- **Por que o push não está disponível?** O suporte depende do navegador e da permissão de notificações do dispositivo.

## Primeiros passos — onboarding

- **id:** `onboarding`
- **aliases:** começar, primeiros passos, calibrar, configurar perfil, renda inicial, escolher modo
- **route_key:** `onboarding`
- **perfis:** `integracao_total`, `hibrido`, `manual`
- **versao:** 1.0.0
- **data_revisao:** 2026-11-16
- **responsavel:** Produto

### Passos

1. Na tela **Primeiros passos**, escolha o perfil que combina com a forma como pretende alimentar seus dados.
2. Se quiser calibrar o planejamento, informe renda mensal líquida, meses de reserva e quanto pretende guardar por mês.
3. Revise a divisão de referência e a estimativa de reserva calculadas a partir das informações digitadas.
4. Escolha **Ir para o painel** para salvar e concluir. Se preferir, use **Pular calibração por agora**; os valores atuais ficam preservados e podem ser ajustados depois.

### FAQ

- **Preciso informar renda para começar?** Não. É possível pular a calibração.
- **O que muda ao escolher um perfil?** O perfil ajusta se a interface permite entradas manuais, importação de arquivos ou integração Open Finance.
- **Posso mudar depois?** Sim. O perfil e as preferências financeiras podem ser revistos em **Minha conta**.
