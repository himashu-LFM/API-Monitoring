import type { ServiceStatus } from "@/lib/types";
import { pctOf, healthClass } from "@/lib/format";

/**
 * Current usage comparison across services (live data, no history).
 * Time-series trends need stored snapshots over time — see the note below.
 */
export default function UsageChart({ services }: { services: ServiceStatus[] }) {
  const rows = services.map((s) => ({ s, p: pctOf(s.usage, s.limit) }));
  const anyTracked = rows.some((r) => r.p != null);

  if (!anyTracked) {
    return <div className="note"><span>ℹ️</span><span>No usage data yet — configure API keys in <b>.env.local</b> to see live usage here.</span></div>;
  }

  return (
    <>
      {rows.map(({ s, p }) => (
        <div key={s.id} style={{ marginBottom: 14 }}>
          <div className="svc-usage" style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>{s.name}</span>
            <span className="tnum" style={{ fontWeight: 600 }}>{p != null ? p + "%" : "—"}</span>
          </div>
          <div className="prog">
            <div className={"fill " + (p != null ? healthClass(p) : "ok")} style={{ width: (p != null ? Math.min(100, p) : 0) + "%" }} />
          </div>
        </div>
      ))}
      <div className="note" style={{ marginTop: 4 }}>
        <span>📈</span>
        <span>Historical trends appear once usage snapshots are stored over time (needs a datastore + scheduled polling).</span>
      </div>
    </>
  );
}
