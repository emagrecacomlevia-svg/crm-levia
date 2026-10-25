import { hubAdminWriteHandler } from "./handler.ts";

Deno.serve((request) => hubAdminWriteHandler(request));
