import { cn } from "@/lib/utils";

export function ServiceAvatar({ name, color, size = 32, className }: { name: string; color: string; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-lg font-semibold text-white", className)}
      style={{ background: color, width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      {name.charAt(0)}
    </span>
  );
}
