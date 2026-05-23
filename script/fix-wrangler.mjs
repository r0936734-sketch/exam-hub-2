import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const wranglerPath = join(__dirname, "..", "dist", "client", "wrangler.json");

try {
  const content = JSON.parse(readFileSync(wranglerPath, "utf-8"));

  // Fix the blocking error: empty triggers object is invalid
  if (content.triggers !== undefined && !content.triggers?.crons) {
    delete content.triggers;
  }

  // Remove unsupported top-level fields (warnings)
  for (const key of [
    "definedEnvironments", "ai_search_namespaces", "ai_search",
    "secrets_store_secrets", "artifacts", "unsafe_hello_world",
    "flagship", "worker_loaders", "ratelimits",
    "vpc_services", "vpc_networks", "python_modules",
  ]) delete content[key];

  // Remove unsupported dev fields
  if (content.dev) {
    delete content.dev.enable_containers;
    delete content.dev.generate_types;
    if (Object.keys(content.dev).length === 0) delete content.dev;
  }

  writeFileSync(wranglerPath, JSON.stringify(content, null, 2));
  console.log("✓ Patched dist/client/wrangler.json successfully");
} catch (e) {
  console.log("No wrangler.json to patch:", e.message);
}