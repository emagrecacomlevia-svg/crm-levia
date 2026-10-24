import { createFileRoute } from "@tanstack/react-router";

import { CorePage } from "@/modules/core/pages";

export const Route = createFileRoute("/app/core")({
  component: CorePage,
});
