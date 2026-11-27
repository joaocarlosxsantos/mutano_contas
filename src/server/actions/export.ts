"use server";

import { requireUserId } from "@/lib/auth";
import { reauthenticateForExport, verifyUserPassword } from "@/lib/reauth";
import { translateServer } from "@/lib/i18n/dictionaries/server";

export type ReauthState = { ok?: boolean; error?: string; token?: string };

/**
 * Confirma a senha do usuário autenticado e gera um token efêmero de autorização
 * para o download seguro de backup de dados.
 */
export async function confirmPasswordForExportAction(
  _prev: ReauthState,
  formData: FormData
): Promise<ReauthState> {
  const userId = await requireUserId();
  const password = formData.get("password");
  const locale = await import("@/lib/i18n/server").then(({ getLocale }) => getLocale()).catch(() => "pt-BR" as const);
  const result = await reauthenticateForExport(userId, password);
  return result.error ? { ...result, error: translateServer(locale, result.error) } : result;
}

/**
 * Validação programática de senha para obtenção de token de exportação.
 */
export async function requestExportToken(password: string): Promise<ReauthState> {
  const userId = await requireUserId();
  const locale = await import("@/lib/i18n/server").then(({ getLocale }) => getLocale()).catch(() => "pt-BR" as const);
  const result = await reauthenticateForExport(userId, password);
  return result.error ? { ...result, error: translateServer(locale, result.error) } : result;
}

/**
 * Verifica a senha atual do usuário sem emitir token (para confirmações sensíveis).
 */
export async function verifyPasswordAction(password: string): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const locale = await import("@/lib/i18n/server").then(({ getLocale }) => getLocale()).catch(() => "pt-BR" as const);
  const result = await verifyUserPassword(userId, password);
  return result.error ? { ...result, error: translateServer(locale, result.error) } : result;
}
