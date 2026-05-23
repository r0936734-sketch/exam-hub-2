import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        name: "fix-wrangler",
        apply: "build",
        enforce: "post",          // ← run AFTER all other plugins including cloudflare
        closeBundle() {
          try {
            const wranglerPath = join(process.cwd(), "dist", "client", "wrangler.json");
            const content = JSON.parse(readFileSync(wranglerPath, "utf-8"));

            // ✅ Fix the blocking error: triggers must have a crons array, or be absent
            if (content.triggers !== undefined && !content.triggers?.crons) {
              delete content.triggers;
            }

            // ✅ Remove unsupported top-level fields (the WARNING fields)
            const unsupportedTop = [
              "definedEnvironments", "ai_search_namespaces", "ai_search",
              "secrets_store_secrets", "artifacts", "unsafe_hello_world",
              "flagship", "worker_loaders", "ratelimits",
              "vpc_services", "vpc_networks", "python_modules",
            ];
            for (const key of unsupportedTop) delete content[key];

            // ✅ Remove unsupported dev fields
            if (content.dev) {
              delete content.dev.enable_containers;
              delete content.dev.generate_types;
              if (Object.keys(content.dev).length === 0) delete content.dev;
            }

            writeFileSync(wranglerPath, JSON.stringify(content, null, 2));
            console.log("✓ Fixed dist/client/wrangler.json");
          } catch {
            // File doesn't exist or isn't JSON — skip silently
          }
        },
      },
    ],
  },
});
