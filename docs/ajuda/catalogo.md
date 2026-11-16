# Catálogo da ajuda do Mutano Contas

- **id:** `catalogo-telas-perfis`
- **aliases:** catálogo, cobertura, telas, perfis, navegação

Versão do corpus: `1.0.0`
Revisado em: `2026-11-16`
Responsável editorial: Produto

Este catálogo contém somente orientações públicas sobre recursos conferidos na interface e no código atual. `route_key` é um identificador editorial, não um link. O acesso a cada tela pode variar pelo perfil.

## Matriz de telas e perfis

| Tela ou recurso | Guia | Integração total | Híbrido | Somente manual | Observação |
| --- | --- | --- | --- | --- | --- |
| Painel e resumo financeiro | `painel` | Sim | Sim | Sim | Conteúdo depende dos dados disponíveis. |
| Insights | `insights` | Sim | Sim | Sim | Pode ficar vazio quando não há movimentações suficientes. |
| Lançamentos, parcelas, divisões e transferências | `lancamentos` | Consulta | Sim | Sim | Inclusão manual aparece nos perfis Híbrido e Somente manual. |
| Contas, saldos, cartões e faturas | `contas-cartoes` | Contas integradas | Sim | Sim | Criar conta manual exige perfil que permita lançamentos manuais. |
| Categorias | `categorias` | Sim | Sim | Sim | Também usadas na classificação de importações. |
| Contas a pagar, grupos e acertos | `contas-a-pagar` | Sim | Sim | Sim | Recurso de planejamento disponível nos três perfis. |
| Orçamento | `orcamento` | Sim | Sim | Sim | Limites são definidos por categoria. |
| Metas e reserva de emergência | `metas-reserva` | Sim | Sim | Sim | Aportes e resgates são registrados na meta. |
| Lançamentos recorrentes | `recorrentes` | Não | Sim | Sim | A tela não fica disponível em Integração total. |
| Projeções | `projecoes` | Sim | Sim | Sim | Simulação; não é promessa de rentabilidade. |
| Dívidas | `dividas` | Sim | Sim | Sim | Inclui cadastro, pagamentos e cenários de quitação. |
| Importar extrato ou fatura | `importar` | Não | Sim | Sim | Importação manual não fica disponível em Integração total. |
| Open Finance e Pluggy | `open-finance` | Sim | Sim | Não | Integração não fica disponível em Somente manual. |
| Minha conta e chave de IA | `minha-conta-ia` | Sim | Sim | Sim | A configuração de chave pode estar indisponível temporariamente. |
| Configurações, categorias e backup | `configuracoes` | Sim | Sim | Sim | Algumas opções aparecem em seções próprias da página. |
| Telegram, bot e comandos | `telegram` | Sim | Sim | Sim | Vincular bot é opcional; comandos funcionam em conversa privada. |
| Notificações | `notificacoes` | Sim | Sim | Sim | Push é configurado por dispositivo; canais dependem de vínculo. |
| Primeiros passos (onboarding) | `onboarding` | Sim | Sim | Sim | Novo usuário escolhe perfil e calibração; é possível adiar renda. |

## Perfis

- **Integração total (`integracao_total`):** movimentações vêm do Open Finance; telas de recorrentes e importação manual são ocultadas. Planejamento e consultas permanecem disponíveis.
- **Híbrido (`hibrido`):** permite conexão Open Finance, registros manuais e importação de arquivos.
- **Somente manual (`manual`):** não oferece integração Open Finance; permite registros manuais, recorrências e importação de arquivos.

## Arquivos aprovados

O manifesto `manifest.json` lista explicitamente os quatro documentos do corpus e seus identificadores. Não ingerir outros arquivos de `docs/` automaticamente.
