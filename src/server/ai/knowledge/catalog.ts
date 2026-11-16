import { z } from "zod";
import artifact from "./corpus.generated.json";
import type { UsageProfile } from "@/lib/usage-profile";

const profileSchema = z.enum(["manual", "hibrido", "integracao_total"]);
const chunkSchema = z.object({ id: z.string().regex(/^[a-z0-9-]+:\d+$/), baseId: z.string(), title: z.string().min(1).max(160), aliases: z.string(),
  routeKey: z.string(), profiles: z.array(profileSchema), text: z.string().min(1).max(1000), source: z.string(), version: z.string(), hash: z.string().length(64) });
const corpusSchema = z.object({ version: z.string(), hash: z.string().length(64), reviewedAt: z.string(), owner: z.string(), chunks: z.array(chunkSchema).max(200) });
export type HelpChunk = z.infer<typeof chunkSchema>;
export const knowledgeCatalog = corpusSchema.parse(artifact);
const byId = new Map(knowledgeCatalog.chunks.map(chunk => [chunk.id, chunk]));
export type HelpContext = { profile: UsageProfile; chunks: readonly HelpChunk[] };

/** Só artefato compilado: ignora texto/título fornecidos pelo chamador. */
export function trustedHelp(context: HelpContext | undefined): HelpChunk[] {
  if (!context || !profileSchema.safeParse(context.profile).success) return [];
  const found: HelpChunk[] = [];
  for (const candidate of context.chunks.slice(0, 3)) {
    const canonical = byId.get(candidate.id);
    if (canonical && canonical.hash === candidate.hash && canonical.profiles.includes(context.profile)
      && !found.some(chunk => chunk.id === canonical.id)
      && Buffer.byteLength(JSON.stringify([...found, canonical])) <= 4096) found.push(canonical);
  }
  return found;
}
