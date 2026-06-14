import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/ping")({
  server: {
    handlers: {
      GET: async () => {
        return new Response("ok", { status: 200 });
      },
    },
  },
});