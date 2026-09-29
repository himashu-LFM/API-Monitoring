"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav";
import { initialsFrom } from "@/lib/user-display";

function isActive(pathname: string, href: string) {
  if (href === "/apis") return pathname === "/apis" || pathname.startsWith("/apis/");
  return pathname === href;
}

export function SidebarContent({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const name = session?.user?.name ?? "Account";
  const email = session?.user?.email ?? "";
  const initials = initialsFrom(session?.user?.name, session?.user?.email);

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex items-center gap-3 px-4 py-4", collapsed && "justify-center px-2")}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Activity className="size-5" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">API Monitor</p>
            <p className="truncate text-xs text-muted-foreground">Usage &amp; Renewal</p>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "text-muted-foreground hover:bg-accent hover:text-foreground",
                active && "bg-accent text-foreground",
                collapsed && "justify-center px-2",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t px-3 py-3">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          title={collapsed ? "Log out" : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            "text-muted-foreground hover:bg-crit/10 hover:text-crit",
            collapsed && "justify-center px-2",
          )}
        >
          <LogOut className="size-4 shrink-0" />
          {!collapsed && <span>Log out</span>}
        </button>

        <div className={cn("mt-2 flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground", collapsed && "justify-center px-0")}>
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-ok" />
          </span>
          {!collapsed && <span>Monitoring active</span>}
        </div>

        {!collapsed && (
          <div className="mt-1 flex items-center gap-2 rounded-md px-3 py-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 text-xs font-semibold text-white">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r bg-sidebar transition-[width] duration-200 lg:block",
        collapsed ? "w-[68px]" : "w-60",
      )}
    >
      <SidebarContent collapsed={collapsed} />
    </aside>
  );
}
