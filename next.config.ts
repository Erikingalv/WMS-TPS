import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Fotografías de producto subidas desde el formulario de alta.
      bodySizeLimit: "8mb",
    },
  },
  images: {
    // Fotografías de producto servidas desde Supabase Storage.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
