"use client";

import { cn } from "@/lib/utils";

export function Segmented<T extends string | number>({ options, value, onChange, className }: {
  options: { label: string; value: T }[]; value: T; onChange: (v: T) => void; className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-md border bg-muted/50 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors",
            value === o.value && "bg-background text-foreground shadow-sm",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
