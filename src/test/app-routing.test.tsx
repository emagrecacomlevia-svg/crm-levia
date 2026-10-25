import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: jsdom cannot load CSS requested by SSR.
const paths = ["/", "/demo", "/login", "/access-denied", "/app", "/app/social-studio", "/app/crm", "/app/core"] as const;

describe("App routing", () => {
  it.each(paths)("matches %s to a page instead of a not-found root", (path) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes(path);

    expect(matches.length).toBeGreaterThan(1);
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("places module routes under the single administrative layout", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    for (const path of paths.filter((value) => value.startsWith("/app"))) {
      const matches = router.matchRoutes(path);
      expect(matches.some((match) => match.routeId === "/app")).toBe(true);
    }
  });
});
