export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type ChatRecentContext = {
  start_date?: string;
  end_date?: string;
  account_scope?: "all" | "credit_card" | "checking";
  toolName?: string;
};

type ChatSession = {
  history: ChatTurn[];
  context: ChatRecentContext;
  updatedAt: number;
};

const CHAT_HISTORY_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 500;
const MAX_TURNS = 8;

const sessions = new Map<string, ChatSession>();

function pruneOldSessions() {
  const now = Date.now();
  for (const [key, session] of sessions.entries()) {
    if (now - session.updatedAt > CHAT_HISTORY_TTL_MS) {
      sessions.delete(key);
    }
  }
  if (sessions.size > MAX_SESSIONS) {
    const sorted = [...sessions.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
    const toDelete = sorted.slice(0, sessions.size - MAX_SESSIONS);
    for (const [k] of toDelete) sessions.delete(k);
  }
}

export function getChatContext(
  chatId: string,
  clientHistory?: Array<{ role: "user" | "assistant"; text: string }>
): { history: ChatTurn[]; context: ChatRecentContext } {
  pruneOldSessions();
  const session = sessions.get(chatId);
  const history: ChatTurn[] = session ? [...session.history] : [];
  const context: ChatRecentContext = session ? { ...session.context } : {};

  if (clientHistory && clientHistory.length > 0) {
    const clientTurns: ChatTurn[] = clientHistory.map((item) => ({
      role: item.role,
      content: item.text,
    }));
    if (history.length === 0) {
      history.push(...clientTurns.slice(-MAX_TURNS));
    }
  }

  return { history, context };
}

export function recordChatTurn(
  chatId: string,
  question: string,
  reply: string,
  contextUpdates?: Partial<ChatRecentContext>
): void {
  pruneOldSessions();
  let session = sessions.get(chatId);
  if (!session) {
    session = { history: [], context: {}, updatedAt: Date.now() };
    sessions.set(chatId, session);
  }
  session.history.push({ role: "user", content: question });
  session.history.push({ role: "assistant", content: reply });
  if (session.history.length > MAX_TURNS) {
    session.history = session.history.slice(-MAX_TURNS);
  }
  if (contextUpdates) {
    session.context = {
      ...session.context,
      ...contextUpdates,
    };
  }
  session.updatedAt = Date.now();
}

export function clearChatHistory(chatId?: string): void {
  if (chatId) {
    sessions.delete(chatId);
  } else {
    sessions.clear();
  }
}
