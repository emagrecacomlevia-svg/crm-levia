import { createFileRoute, redirect } from "@tanstack/react-router";

import { CrmPage } from "@/modules/crm/pages";
import { checkCapabilityFn } from "@/modules/identity/auth.functions";

export const Route = createFileRoute("/app/crm")({
  beforeLoad: async () => {
    const access = await checkCapabilityFn({
      data: { capability: "crm.read", scopeKind: "module", scopeKey: "crm" },
    });
    if (access.state === "authorized") return;
    if (access.state === "anonymous") throw redirect({ to: "/login" });
    throw redirect({ to: "/access-denied" });
  },
  component: CrmPage,
});
