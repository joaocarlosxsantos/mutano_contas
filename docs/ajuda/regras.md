# Regras do produto

- **id:** `regras-gerais`
- **aliases:** regras financeiras, limites do produto, comportamento do app

Versão `1.0.0` · revisão `2026-11-16` · responsável: Produto. Estas regras foram extraídas da implementação atual; não representam aconselhamento financeiro.

## Perfis e disponibilidade

- **Integração total:** movimentações priorizam contas conectadas; lançamentos manuais, recorrentes e importação manual não ficam disponíveis. Open Finance e telas de planejamento continuam acessíveis.
- **Híbrido:** permite Open Finance, movimentação manual, recorrentes e importação de arquivos.
- **Somente manual:** permite movimentação manual, recorrentes e importação; Open Finance fica desativado.
- O perfil muda o que pode ser feito, não autoriza misturar dados de outra conta.

## Lançamentos, cartão e transferência

- Uma despesa de cartão é demonstrativa enquanto não paga: fica separada dos totais de entradas e saídas em conta. O pagamento da fatura representa a saída de dinheiro da conta.
- Uma transferência entre contas próprias tem origem e destino, mas não é receita nem despesa. Na lista geral, o par é apresentado como uma transferência para evitar contagem dupla; excluir o par remove suas duas pernas.
- Parcelamento divide o valor informado em parcelas mensais. Diferença de centavos pode fazer a última parcela variar.
- Uma despesa dividida registra a parte de outras pessoas; a seção **A receber** reúne esses valores e valores relativos a contas compartilhadas.

## Orçamento e planejamento

- O orçamento acompanha categorias com limite definido. Um gasto em categoria sem limite não entra no valor acompanhado até que um limite seja criado.
- O estado de atenção começa em 80% do limite; acima de 100% o limite foi ultrapassado.
- Aporte e resgate em meta atualizam o valor guardado. O saldo de investimento é apresentado separadamente e não é automaticamente atribuído às metas.
- Projeções comparam cenários de rentabilidade e aportes; são simulações, não garantias de resultado.
- O simulador de dívidas compara avalanche (maior juros primeiro) e bola de neve (menor saldo primeiro). Os resultados dependem dos saldos, taxas e pagamentos informados.

## Open Finance e dados atualizados

- Uma conexão autorizada não garante que todas as contas ou snapshots já tenham sido lidos. Confira o resultado por conta e a data/hora mostrada.
- Dado ausente ou saldo parcial deve continuar sinalizado como incompleto; não deve ser interpretado como zero.
- Ao desconectar uma conexão, leia a confirmação para escolher entre manter os lançamentos importados ou removê-los.

## Chave e assistente de IA

- A chave pessoal habilita perguntas livres ao assistente e é guardada criptografada. A interface exibe somente provedor e últimos quatro caracteres; não revela a chave salva novamente.
- Remover a chave do app não revoga a chave no provedor. Faça a revogação também na conta do provedor se desejar invalidá-la.
- Pergunta e dados financeiros mínimos usados na consulta podem ser enviados ao provedor escolhido. O assistente consulta dados; não deve criar ou editar registros.
- Sem chave configurada, perguntas livres não têm acesso à IA pessoal. Os comandos determinísticos do bot permanecem separados.

## Privacidade e exemplos

- Os guias descrevem somente fluxos públicos do produto. Não incluir nomes, saldos, categorias, datas, identificadores, chaves, registros de cliente, credenciais ou detalhes internos de servidor.
- Exemplos adicionados em futuras revisões devem ser inteiramente sintéticos e identificados como exemplo.
