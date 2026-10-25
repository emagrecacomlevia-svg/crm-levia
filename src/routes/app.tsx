import { createFileRoute, redirect } from "@tanstack/react-router";

import { AdminShell } from "@/app/layouts/admin-shell";
import { getAdminAccessFn } from "@/modules/identity/server/auth.functions";

export const Route = createFileRoute("/app")({
  headers: () => ({ "Cache-Control": "private, no-store" }),
  beforeLoad: async () => {
    const access = await getAdminAccessFn();
    if (access.state === "anonymous") throw redirect({ to: "/login" });
    // A failed Auth provider check or unverified database authorization
    // always denies the internal route. UI state is never an access grant.
    throw redirect({ to: "/access-denied" });
  },
  component: AdminShell,
});
