import { createFileRoute } from "@tanstack/react-router";

import { SocialStudioPage } from "@/modules/social-studio/pages";

export const Route = createFileRoute("/app/social-studio")({
  component: SocialStudioPage,
});
