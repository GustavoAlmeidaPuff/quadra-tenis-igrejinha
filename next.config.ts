import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
        port: "",
        search: "",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/**",
        port: "",
        search: "",
      },
      {
        protocol: "https",
        hostname: "i.imgur.com",
        pathname: "/**",
        port: "",
        search: "",
      },
      {
        protocol: "https",
        hostname: "i.ibb.co",
        pathname: "/**",
        port: "",
        search: "",
      },
    ],
  },
};

export default nextConfig;
