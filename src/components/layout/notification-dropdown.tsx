"use client";

import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { TONE_CLASSES, SEVERITY_META } from "@/lib/status";
import { useAppState } from "@/hooks/use-app-state";

export function NotificationDropdown() {
  const router = useRouter();
  const { notifications, unreadNotifications, markAllNotificationsRead } = useAppState();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="size-[18px]" />
            {unreadNotifications > 0 && (
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-crit ring-2 ring-background" />
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <button
            className="text-xs font-medium text-info hover:underline"
            onClick={markAllNotificationsRead}
          >
            Mark all as read
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.map((n) => {
            const tone = SEVERITY_META[n.severity].tone;
            return (
              <button
                key={n.id}
                onClick={() => router.push(`/apis/${n.serviceId}`)}
                className={cn(
                  "flex w-full items-start gap-3 border-b px-4 py-3 text-left last:border-b-0 hover:bg-accent",
                  !n.read && "bg-accent/50",
                )}
              >
                <span className={cn("mt-0.5 size-2 shrink-0 rounded-full", TONE_CLASSES[tone].dot)} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", !n.read ? "font-semibold" : "font-medium")}>{n.title}</span>
                  <span className="block text-xs text-muted-foreground">{n.timeLabel}</span>
                </span>
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
