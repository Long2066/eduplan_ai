import type { NextConfig } from "next";
import { dirname } from "path";
import { fileURLToPath } from "url";

const appDir = dirname(fileURLToPath(import.meta.url));
const workspaceDir = dirname(appDir);

const nextConfig: NextConfig = {
  outputFileTracingRoot: workspaceDir,
};

export default nextConfig;
