import { hubCatalogOwnerHandler } from "./handler.ts";

Deno.serve((request) => hubCatalogOwnerHandler(request));
