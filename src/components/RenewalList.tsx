import type { ServiceStatus } from "@/lib/types";
import { daysUntil, fmtDate } from "@/lib/format";

export default function RenewalList({ services }: { services: ServiceStatus[] }) {
  const withDates = services.filter((s) => s.renewalISO);
  const sorted = [...withDates].sort((a, b) => (daysUntil(a.renewalISO) ?? 1e9) - (daysUntil(b.renewalISO) ?? 1e9));

  if (sorted.length === 0) {
    return <div className="note"><span>ℹ️</span><span>Set <b>*_RENEWAL</b> dates in .env.local to track billing resets.</span></div>;
  }

  return (
    <>
      {sorted.map((s) => {
        const d = daysUntil(s.renewalISO);
        const color = d != null && d <= 3 ? "var(--crit)" : d != null && d <= 7 ? "var(--warn)" : "var(--text)";
        return (
          <div className="arow" key={s.id}>
            <span className="ai" style={{ background: s.color + "22", color: s.color }}>◆</span>
            <div>
              <div className="t">{s.name}</div>
              <div className="m">{fmtDate(s.renewalISO)}</div>
            </div>
            <div className="rt">
              <div className="d" style={{ color }}>{d != null ? d + "d" : "—"}</div>
              <div className="u">remaining</div>
            </div>
          </div>
        );
      })}
    </>
  );
}
