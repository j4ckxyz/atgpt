import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // We live below other JS projects; pin tracing to this app.
  outputFileTracingRoot: __dirname,
  // Self-contained server bundle for the Docker image.
  output: "standalone",
  // Native-ish deps that must stay external to the server bundle.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
