import { createFileRoute, redirect } from "@tanstack/react-router";

import { SocialStudioPage } from "@/modules/social-studio/pages";
import { checkCapabilityFn } from "@/modules/identity/auth.functions";

export const Route = createFileRoute("/app/social-studio")({
  beforeLoad: async () => {
    const access = await checkCapabilityFn({
      data: { capability: "social.read", scopeKind: "module", scopeKey: "social" },
    });
    if (access.state === "authorized") return;
    if (access.state === "anonymous") throw redirect({ to: "/login" });
    throw redirect({ to: "/access-denied" });
  },
  component: SocialStudioPage,
});
