import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Stockly — simple inventory, fair price", template: "%s · Stockly" },
  description:
    "Track stock, tools and equipment from your phone. Scan barcodes, get low-stock alerts, and never pay for item limits.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#187a64",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
