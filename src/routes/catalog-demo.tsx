import { createFileRoute } from "@tanstack/react-router";
import { CatalogDemo } from "@/modules/core/catalog/catalog-demo";
import { HubShell } from "@/app/layouts/hub-shell";

export const Route = createFileRoute("/catalog-demo")({
  component: () => (
    <HubShell>
      <CatalogDemo />
    </HubShell>
  ),
  headers: () => ({ "Cache-Control": "public, max-age=60" }),
});
