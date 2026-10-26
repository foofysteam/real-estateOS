import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sales OS",
  description: "Real-estate sales CRM",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-bg text-fg antialiased">{children}</body>
    </html>
  );
}
