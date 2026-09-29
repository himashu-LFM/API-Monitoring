import { LayoutGrid, Layers, CalendarClock, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "APIs", href: "/apis", icon: Layers },
  { label: "Renewals", href: "/renewals", icon: CalendarClock },
];
