import { z } from "zod";
import { AI_MAX_OUTPUT_TOKENS, AI_TOOLS } from "./ai-policy";
import type { AiMessage } from "./ai";

export const OPENAI_MODEL = "gpt-4.1-mini";
export const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const responseSchema = z.object({ choices: z.array(z.object({
  finish_reason: z.enum(["stop", "tool_calls"]),
  message: z.object({ content: z.string().max(8000).nullable(), tool_calls: z.array(z.object({
    id: z.string().min(1).max(100), type: z.literal("function"),
    function: z.object({ name: z.string().max(64), arguments: z.string().max(2500) }),
  })).max(4).optional() }),
})).length(1) });

export function openaiRequest(messages: AiMessage[], system: string) {
  const history: unknown[] = [{ role: "system", content: system }];
  for (const message of messages) {
    if (typeof message.content === "string") { history.push({ role: message.role, content: message.content }); continue; }
    if (message.role === "assistant") {
      const text = message.content.filter(block => block.type === "text").map(block => block.text).join("\n");
      const calls = message.content.filter(block => block.type === "tool_use").map(block => ({
        id: block.id, type: "function", function: { name: block.name, arguments: JSON.stringify(block.input) },
      }));
      history.push({ role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
    } else {
      for (const block of message.content) if (block.type === "tool_result")
        history.push({ role: "tool", tool_call_id: block.tool_use_id, content: block.content });
    }
  }
  return { model: OPENAI_MODEL, max_completion_tokens: AI_MAX_OUTPUT_TOKENS, store: false, messages: history,
    tools: AI_TOOLS.map(tool => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.input_schema } })),
  };
}

export function openaiReply(raw: unknown) {
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) return null;
  const choice = parsed.data.choices[0];
  const calls = choice.message.tool_calls ?? [];
  if ((calls.length > 0) !== (choice.finish_reason === "tool_calls")) return null;
  try {
    return { stop_reason: calls.length ? "tool_use" : "end_turn", content: [
      ...(choice.message.content ? [{ type: "text", text: choice.message.content }] : []),
      ...calls.map(call => ({ type: "tool_use", id: call.id, name: call.function.name, input: JSON.parse(call.function.arguments) as unknown })),
    ] };
  } catch { return null; }
}
