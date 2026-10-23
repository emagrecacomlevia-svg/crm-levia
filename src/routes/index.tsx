import { createFileRoute } from "@tanstack/react-router";

import { HubHome } from "@/app/hub-home";

export const Route = createFileRoute("/")({
  component: HubHome,
});
