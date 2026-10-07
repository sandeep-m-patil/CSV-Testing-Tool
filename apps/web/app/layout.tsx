import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { Providers } from "@/lib/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Autotest — Autonomous Web Testing Platform",
  description: "Discover applications, build workflows, and generate test cases autonomously.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

/** The app is dark-only: `dark` is hard-coded on <html> and there is no theme switcher. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
        <Toaster theme="dark" richColors closeButton position="top-right" />
      </body>
    </html>
  );
}
