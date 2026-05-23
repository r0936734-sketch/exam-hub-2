// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { readFileSync, unlinkSync } from "fs";
import { join } from "path";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        name: "cleanup-wrangler",
        apply: "build",
        closeBundle() {
          try {
            const wranglerPath = join(process.cwd(), "dist", "client", "wrangler.json");
            readFileSync(wranglerPath);
            unlinkSync(wranglerPath);
            console.log("✓ Removed dist/client/wrangler.json");
          } catch {
            // File doesn't exist, which is fine
          }
        },
      },
    ],
  },
});
