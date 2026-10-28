import { createFileRoute, redirect } from "@tanstack/react-router";

import { checkCapabilityFn } from "@/modules/identity/auth.functions";
import { CatalogWorkspace } from "@/modules/core/catalog/catalog-workspace";

export const Route = createFileRoute("/app/catalog")({
  headers: () => ({ "Cache-Control": "private, no-store" }),
  beforeLoad: async () => {
    const access = await checkCapabilityFn({
      data: { capability: "catalog.read", scopeKind: "module", scopeKey: "catalog" },
    });
    if (access.state === "authorized") return;
    if (access.state === "anonymous") throw redirect({ to: "/login" });
    throw redirect({ to: "/access-denied" });
  },
  component: CatalogWorkspace,
});
