import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // We live below other JS projects; pin tracing to this app.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
