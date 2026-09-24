import { AppShell } from "@/components/layout/app-shell";

/**
 * Rendered per request rather than prerendered at build time: these pages
 * compute "days remaining" from the real current date, so a build-time
 * snapshot would bake in the build date and mismatch on hydration.
 */
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
