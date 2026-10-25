import { createFileRoute, redirect } from "@tanstack/react-router";

import { CorePage } from "@/modules/core/pages";
import { checkCapabilityFn } from "@/modules/identity/auth.functions";

export const Route = createFileRoute("/app/core")({
  beforeLoad: async () => {
    const access = await checkCapabilityFn({
      data: { capability: "core.read", scopeKind: "module", scopeKey: "core" },
    });
    if (access.state === "authorized") return;
    if (access.state === "anonymous") throw redirect({ to: "/login" });
    throw redirect({ to: "/access-denied" });
  },
  component: CorePage,
});
