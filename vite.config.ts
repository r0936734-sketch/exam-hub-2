import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },

  vite: {
    server: {
      allowedHosts: true,
    },

    preview: {
      allowedHosts: true,
    },

    optimizeDeps: {
      exclude: ["@mapbox/node-pre-gyp", "mock-aws-s3", "aws-sdk", "nock"],
    },

    ssr: {
      external: ["@mapbox/node-pre-gyp", "mock-aws-s3", "aws-sdk", "nock"],
    },
  },
});
