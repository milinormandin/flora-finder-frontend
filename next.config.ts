import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: [new URL('https://inaturalist-open-data.s3.amazonaws.com/**'), new URL('https://static.inaturalist.org/**')],
  },
};

export default nextConfig;
