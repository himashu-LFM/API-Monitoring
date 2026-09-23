import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { AppStateProvider } from "@/hooks/use-app-state";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "API Monitor",
  description: "Usage & renewal monitoring for your APIs and SaaS services.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body>
        <ThemeProvider>
          <AppStateProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster position="bottom-right" />
          </AppStateProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
