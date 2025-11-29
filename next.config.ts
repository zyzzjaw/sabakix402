import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Amplify runs next build; skip lint errors there, run lint via npm run lint locally instead.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
