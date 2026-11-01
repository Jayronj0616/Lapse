import { createRouteHandler } from "@openpanel/nextjs/server";

// First-party proxy for OpenPanel, so ad blockers that drop third-party
// analytics requests do not drop these.
export const { GET, POST } = createRouteHandler();
