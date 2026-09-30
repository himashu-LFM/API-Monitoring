"use client";

import { usePathname } from "next/navigation";
import { Menu, RefreshCw, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useAppState } from "@/hooks/use-app-state";
import { initialsFrom } from "@/lib/user-display";
import { SidebarContent } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { useEffect, useState } from "react";

const TITLES: Record<string, { title: string; crumb: string }> = {
  "/dashboard": { title: "Dashboard", crumb: "Overview of all monitored services" },
  "/apis": { title: "APIs", crumb: "Monitor usage, limits and renewals" },
  "/renewals": { title: "Renewals", crumb: "Billing cycle calendar" },
};

/**
 * Re-render on a timer so the "Updated …" label actually ages.
 *
 * `relative()` is computed during render, and nothing re-rendered this bar
 * between polls — so it kept saying "just now" while the data underneath was
 * up to 15 minutes old. On a monitoring dashboard that is the worst kind of
 * wrong: it looks freshest exactly when it is most stale.
 */
function useTicker(everyMs = 30_000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
}

function relative(ts: number) {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const h = Math.round(mins / 60);
  return h === 1 ? "1 hour ago" : `${h} hours ago`;
}

export function Topbar({ collapsed, onToggleCollapse }: { collapsed: boolean; onToggleCollapse: () => void }) {
  const pathname = usePathname();
  const { lastUpdated, refreshing, refresh, hydrated } = useAppState();
  useTicker();
  const { data: session } = useSession();
  const userName = session?.user?.name ?? "Account";
  const initials = initialsFrom(session?.user?.name, session?.user?.email);
  const [mobileOpen, setMobileOpen] = useState(false);

  const meta = pathname.startsWith("/apis/") && pathname !== "/apis"
    ? { title: "API Details", crumb: "APIs / Details" }
    : TITLES[pathname] ?? { title: "API Monitor", crumb: "" };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-4">
      {/* mobile nav */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
              <Menu className="size-5" />
            </Button>
          }
        />
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* desktop collapse */}
      <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={onToggleCollapse} aria-label="Toggle sidebar">
        <PanelLeft className="size-[18px]" />
      </Button>

      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-semibold leading-tight">{meta.title}</h1>
        <p className="hidden truncate text-xs text-muted-foreground sm:block">{meta.crumb}</p>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing} className="gap-2">
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {refreshing
              ? "Refreshing…"
              : !hydrated || lastUpdated === 0
                // Nothing has come back yet — say so instead of inventing an age.
                ? "Checking…"
                : `Updated ${relative(lastUpdated)}`}
          </span>
        </Button>

        <ThemeToggle />

        <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 text-xs font-semibold text-white" title={userName}>
          {initials}
        </span>
      </div>
    </header>
  );
}
