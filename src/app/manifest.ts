import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WMS — Resguardo & Control",
    short_name: "WMS",
    description:
      "Warehouse Management System para bodega de resguardo de mercancías.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f1ec",
    theme_color: "#2f5d62",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
