// One catalog feeds both the plain-text welcome and Telegram's command menu.
const groups = [
  { title: "💰 Saldo e investimentos", commands: [
    { command: "saldo", description: "Consultar disponível, investido e patrimônio." },
    { command: "previsao", description: "Ver a previsão de fechamento do mês." },
    { command: "hoje", description: "Ver quanto você pode gastar hoje." },
  ] },
  { title: "🔄 Lançamentos e assinaturas", commands: [
    { command: "assinaturas", description: "Consultar assinaturas e aumentos de preço." },
  ] },
  { title: "📅 Resumos", commands: [
    { command: "resumo", description: "Ver o resumo diário com contas, faturas e avisos." },
    { command: "relatorio", description: "Ver o relatório do mês." },
  ] },
  { title: "💳 Contas e cartões", commands: [
    { command: "cartao", description: "Consultar faturas, limites e últimas compras." },
  ] },
  { title: "🔔 Ajuda e avisos", commands: [
    { command: "start", description: "Iniciar ou vincular pelo link gerado no app." },
    { command: "menu", description: "Mostrar este menu." },
    { command: "ajuda", description: "Mostrar os comandos disponíveis." },
    { command: "pausar", description: "Pausar os avisos automáticos." },
  ] },
] as const;

export const BOT_COMMANDS = groups.flatMap(group => group.commands.map(command => ({ ...command })));

// No Markdown/HTML or escaping: /command (including any underscores) stays intact.
export const HELP = [
  "Oi! 👋 Sou o Mutano. Vamos olhar suas contas? Escolha um comando:",
  ...groups.map(group => `${group.title}\n${group.commands.map(c => `/${c.command} — ${c.description}`).join("\n")}`),
  "💬 Você também pode perguntar: quais foram minhas maiores despesas este mês? Para criar ou editar lançamentos, use o app.",
  "💰 Com a IA habilitada, posso consultar saldos, gastos e contas a vencer. Sua pergunta e os dados necessários vão para o provedor configurado. ⏱️ Você pode fazer 2 perguntas por minuto e 20 por dia.",
  "⚙️ Para conectar, retomar avisos ou desconectar, abra Configurações no app.",
].join("\n\n");

export const LINKED_WELCOME = `✅ Pronto! Seu Telegram está conectado ao Mutano Contas.\n\n${HELP}`;
export const isWelcomeReply = (reply: string | null) => reply === HELP || reply === LINKED_WELCOME;
