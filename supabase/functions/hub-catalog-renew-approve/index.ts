import { hubCatalogRenewalApprovalHandler } from "./handler.ts";

Deno.serve((request) => hubCatalogRenewalApprovalHandler(request));
