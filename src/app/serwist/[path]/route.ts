import { createSerwistRoute } from "@serwist/turbopack";
import { spawnSync } from "node:child_process";

// A revision string busts the precache entry when the offline page's
// content changes. `git rev-parse HEAD` is a convenient source of one at
// build time; fall back to a random value if git isn't available.
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout.trim() ||
  crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/offline", revision }],
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});
