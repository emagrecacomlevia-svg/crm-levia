import { createServerFn } from "@tanstack/react-start";

import { getVerifiedServerAccessToken } from "@/modules/identity/auth.functions";
import { getPublicSupabaseSettings } from "@/modules/identity/server/auth-api.server";
import { isCatalogCommand, type CatalogCommand, type CatalogSnapshot } from "./persistent";

type CatalogResult = { ok: true; snapshot: CatalogSnapshot } | { ok: true; id: string } |
  { ok: false; message: string };

async function gateway(request: Record<string, string | number>): Promise<CatalogResult> {
  const token = await getVerifiedServerAccessToken();
  if (!token) return { ok: false, message: "Sessão inválida ou expirada. Faça login novamente." };
  const cfg = getPublicSupabaseSettings();
  if (!cfg) return { ok: false, message: "Serviço de catálogo indisponível." };
  try {
    const res = await fetch(cfg.origin + "/functions/v1/hub-catalog", {
      method: "POST",
      headers: {
        apikey: cfg.key, authorization: "Bearer " + token,
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (res.status === 401 || res.status === 403)
      return { ok: false, message: "Acesso negado: sem permissão vigente no catálogo." };
    if (res.status === 409)
      return { ok: false, message: "Registro duplicado, inválido ou histórico já bloqueado." };
    if (!res.ok) return { ok: false, message: "Serviço de catálogo indisponível." };
    const data: unknown = await res.json();
    if (!data || typeof data !== "object") return { ok: false, message: "Resposta inválida." };
    const raw = data as Record<string, unknown>;
    if (raw["ok"] !== true) return { ok: false, message: "Operação não autorizada." };
    if (request["action"] !== "snapshot") {
      return typeof raw["id"] === "string"
        ? { ok: true, id: raw["id"] }
        : { ok: false, message: "Persistência não confirmada." };
    }
    const names = ["items", "versions", "tables", "prices", "selections", "campaigns", "references", "audit"] as const;
    if (names.some((name) => !Array.isArray(raw[name])))
      return { ok: false, message: "Resposta incompleta do catálogo." };
    return { ok: true, snapshot: raw as unknown as CatalogSnapshot };
  } catch {
    return { ok: false, message: "Conexão indisponível. Nenhuma operação foi confirmada." };
  }
}

export const getCatalogSnapshotFn = createServerFn({ method: "GET" }).handler(
  async () => gateway({ action: "snapshot" }),
);

export const writeCatalogFn = createServerFn({ method: "POST" })
  .validator((input: CatalogCommand) => {
    if (!isCatalogCommand(input)) throw new Error("Comando de catálogo inválido.");
    return input;
  })
  .handler(async ({ data }) => gateway(data));
