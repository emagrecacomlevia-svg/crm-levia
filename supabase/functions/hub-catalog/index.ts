import { hubCatalogHandler } from "./handler.ts";

Deno.serve((request) => hubCatalogHandler(request));
