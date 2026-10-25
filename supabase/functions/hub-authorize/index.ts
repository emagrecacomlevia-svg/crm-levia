import { hubAuthorizeHandler } from "./handler.ts";

Deno.serve((request) => hubAuthorizeHandler(request));
