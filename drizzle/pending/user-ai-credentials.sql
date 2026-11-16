-- PENDENTE: revisão/aplicação manual. Não executar automaticamente.
CREATE TABLE IF NOT EXISTS "user_ai_credentials" (
  "user_id" varchar(32) PRIMARY KEY NOT NULL,
  "provider" text NOT NULL,
  "api_key_envelope" text NOT NULL,
  "last4" varchar(4) NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "user_ai_credentials_provider_chk" CHECK ("provider" IN ('claude', 'openai', 'gemini')),
  CONSTRAINT "user_ai_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);
