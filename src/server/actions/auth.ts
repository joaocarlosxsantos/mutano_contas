"use server";

import type { Locale } from "@/lib/i18n/config";
import { translateServer } from "@/lib/i18n/dictionaries/server";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { accounts, categories, users } from "@/db/schema";
import { signIn, signOut } from "@/lib/auth";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { checkRateLimit, isRateLimited, recordFailure } from "@/lib/rate-limit";
import { safeNameSchema } from "@/server/validation/sanitization";

export type FormState = { error?: string; ok?: boolean };

function localizedregisterSchema(locale: Locale) { return z
  .object({
    name: safeNameSchema(2, 100, translateServer(locale, "Digite seu nome.")),
    email: z.string().trim().toLowerCase().email(translateServer(locale, "E-mail inválido.")).max(255, translateServer(locale, "E-mail muito longo.")),
    password: z.string().min(8, translateServer(locale, "A senha precisa ter pelo menos 8 caracteres.")).max(128, translateServer(locale, "A senha não pode ter mais de 128 caracteres.")),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: translateServer(locale, "As senhas não são iguais."),
    path: ["confirm"],
  }); }


function localizedloginInputSchema(locale: Locale) { return z.object({
  email: z.string().trim().toLowerCase().email(translateServer(locale, "E-mail inválido.")).max(255),
  password: z.string().min(1, translateServer(locale, "Informe a senha.")).max(128, translateServer(locale, "Senha muito longa.")),
}); }


async function getClientIp(): Promise<string> {
  try {
    const headerList = await headers();
    // Prioriza cabeçalhos seguros injetados pela infraestrutura de borda confiável
    const vercelIp = headerList.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
    if (vercelIp) return vercelIp;

    const realIp = headerList.get("x-real-ip")?.trim();
    if (realIp) return realIp;

    const forwarded = headerList.get("x-forwarded-for");
    if (forwarded) {
      // Lê o último IP da cadeia (adicionado pelo proxy reverso confiável),
      // prevenindo spoofing via injeção de IP arbitrário pelo cliente no início da lista.
      const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
      const last = parts[parts.length - 1];
      if (last) return last;
    }
  } catch {
    // Fora de requisição HTTP (ex: testes de unidade)
  }
  return "127.0.0.1";
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await import("@/lib/i18n/server").then(({ getLocale }) => getLocale()).catch(() => "pt-BR" as const);
  const parsed = localizedregisterSchema(locale).safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return { error: translateServer(locale, parsed.error.issues[0]?.message ?? translateServer(locale, "Confira os dados.")) };
  }

  const { name, email, password } = parsed.data;

  const rateLimit = checkRateLimit(`register:${email}`);
  if (!rateLimit.allowed) {
    return { error: translateServer(locale, "Muitas tentativas. Tente novamente em alguns minutos.") };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    let userId: string;
    await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ name, email, passwordHash })
        .returning({ id: users.id });
      userId = user.id;

      await tx.insert(categories).values(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })));
      await tx.insert(accounts).values([
        { userId, name: translateServer(locale, "Conta corrente"), type: "CHECKING" as const, color: "#2349C9" },
        { userId, name: translateServer(locale, "Cartão de crédito"), type: "CREDIT_CARD" as const, color: "#C0352B" },
      ]);
    });
  } catch (error: unknown) {
    // drizzle embrulha o erro do driver em .cause
    const e = error as { code?: string; cause?: { code?: string } };
    if (e.code === "23505" || e.cause?.code === "23505") {
      return { error: translateServer(locale, "Erro ao criar a conta. Tente novamente.") };
    }
    throw error;
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) return { error: translateServer(locale, "Conta criada, mas o login falhou. Tente entrar.") };
    throw error;
  }

  redirect("/onboarding");
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = await import("@/lib/i18n/server").then(({ getLocale }) => getLocale()).catch(() => "pt-BR" as const);
  const rawEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  const rawPassword = String(formData.get("password") ?? "");

  const parsed = localizedloginInputSchema(locale).safeParse({ email: rawEmail, password: rawPassword });
  if (!parsed.success) {
    return { error: translateServer(locale, parsed.error.issues[0]?.message ?? translateServer(locale, "Preencha e-mail e senha.")) };
  }

  const { email, password } = parsed.data;
  const clientIp = await getClientIp();

  const emailRateLimit = isRateLimited(`login:${email}`);
  if (!emailRateLimit.allowed) {
    const waitMsg = emailRateLimit.retryAfterSeconds
      ? translateServer(locale, " Tente novamente em {0} minuto(s).", Math.ceil(emailRateLimit.retryAfterSeconds / 60))
      : translateServer(locale, " Tente novamente em alguns minutos.");
    return { error: translateServer(locale, "Muitas tentativas para esta conta.{0}", waitMsg) };
  }

  const ipKey = `login:ip:${clientIp}`;
  const ipRateLimit = isRateLimited(ipKey, 20);
  if (!ipRateLimit.allowed) {
    const waitMsg = ipRateLimit.retryAfterSeconds
      ? translateServer(locale, " Tente novamente em {0} minuto(s).", Math.ceil(ipRateLimit.retryAfterSeconds / 60))
      : translateServer(locale, " Tente novamente em alguns minutos.");
    return { error: translateServer(locale, "Muitas tentativas a partir desta rede.{0}", waitMsg) };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/painel" });
  } catch (error) {
    if (error instanceof AuthError) {
      recordFailure(ipKey);
      return { error: translateServer(locale, "E-mail ou senha incorretos.") };
    }
    throw error;
  }
  return {};
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
