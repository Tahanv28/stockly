import type { MetadataRoute } from "next";

// Lets people add Stockly to their phone's home screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stockly",
    short_name: "Stockly",
    description: "Simple inventory: stock, tools and equipment from your phone.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f6f7f6",
    theme_color: "#187a64",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
