import { createFileRoute } from "@tanstack/react-router";

import { CrmPage } from "@/modules/crm/pages";

export const Route = createFileRoute("/app/crm")({
  component: CrmPage,
});
