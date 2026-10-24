import { createFileRoute } from "@tanstack/react-router";

import { AdminOverviewPage } from "@/app/pages/admin-overview";

export const Route = createFileRoute("/app/")({
  component: AdminOverviewPage,
});
