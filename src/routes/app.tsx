import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/app/layouts/admin-shell";

export const Route = createFileRoute("/app")({
  component: AdminShell,
});
