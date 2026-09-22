import type { ServiceStatus } from "@/lib/types";
import { pctOf, healthClass } from "@/lib/format";

export default function Kpis({ services }: { services: ServiceStatus[] }) {
  const counts = { ok: 0, warn: 0, high: 0, crit: 0 };
  let tracked = 0;
  services.forEach((s) => {
    const p = pctOf(s.usage, s.limit);
    if (p != null) { counts[healthClass(p)]++; tracked++; }
  });
  const warnish = counts.warn + counts.high;
  const unconfigured = services.length - tracked;

  const items = [
    { lbl: "Total APIs", val: services.length, ctx: `${tracked} reporting usage`, color: "var(--accent)" },
    { lbl: "Healthy", val: counts.ok, ctx: "below 50% usage", color: "var(--ok-line)" },
    { lbl: "Warning", val: warnish, ctx: "at or above 50%", color: "var(--warn-line)" },
    { lbl: "Critical", val: counts.crit, ctx: unconfigured ? `${unconfigured} not configured` : "at or above 90%", color: "var(--crit-line)" },
  ];

  return (
    <div className="kpis">
      {items.map((k) => (
        <div className="kpi" key={k.lbl}>
          <div className="lbl">{k.lbl}<span className="dot" style={{ background: k.color }} /></div>
          <div className="val tnum">{k.val}</div>
          <div className="ctx">{k.ctx}</div>
        </div>
      ))}
    </div>
  );
}
