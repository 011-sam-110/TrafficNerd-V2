import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // satellite.js v7's barrel re-exports a WASM threading runtime
      // (dist/wasm/*) that imports `node:worker_threads` / `node:module`.
      // We only use the classic synchronous SGP4 path (twoline2satrec +
      // propagate), so that runtime is bundled-but-never-executed. Strip the
      // `node:` scheme and stub those built-ins in the BROWSER bundle so
      // webpack can resolve them; nothing at runtime ever touches them.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
      config.resolve.fallback = {
        ...config.resolve.fallback,
        worker_threads: false,
        module: false,
        fs: false,
        path: false,
        os: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
