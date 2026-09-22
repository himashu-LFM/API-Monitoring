import type { ServiceStatus } from "@/lib/types";
import { pctOf, healthClass, healthLabel, fmtDate, fmtNum, daysUntil } from "@/lib/format";

interface Props {
  service: ServiceStatus;
  threshold: number;
  onThreshold: (id: string, value: number) => void;
}

const STATUS_NOTE: Record<string, string> = {
  not_configured: "Not configured",
  error: "Error",
};

export default function ServiceCard({ service: s, threshold, onThreshold }: Props) {
  const p = pctOf(s.usage, s.limit);
  const hc = p != null ? healthClass(p) : "ok";
  const d = daysUntil(s.renewalISO);
  const daysColor = d != null && d <= 3 ? "var(--crit)" : d != null && d <= 7 ? "var(--warn)" : "var(--text)";

  const alerting = p != null && p >= threshold;
  const alertCls = alerting ? (p >= 90 ? "crit" : p >= 75 ? "high" : "warn") : "ok";
  const alertTxt = p == null ? "—" : p >= 100 ? "Over limit" : alerting ? `Alerting @${threshold}%` : "OK";

  return (
    <div className="svc">
      <div className="svc-top">
        <div className="svc-ic" style={{ background: s.color }}>{s.name[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="svc-name">{s.name}</div>
          <div className="svc-prov">{s.provider}</div>
        </div>
        {s.status === "ok" && p != null
          ? <span className={"badge " + hc}><span className="bd" />{healthLabel(p)}</span>
          : <span className="badge info"><span className="bd" />{STATUS_NOTE[s.status] ?? s.status}</span>}
      </div>

      {p != null ? (
        <>
          <div className="svc-usage">
            <span className="mono tnum">{fmtNum(s.usage)} / {fmtNum(s.limit)} {s.unit}</span>
            <span className="n tnum">{p}%</span>
          </div>
          <div className="prog"><div className={"fill " + hc} style={{ width: Math.min(100, p) + "%" }} /></div>
        </>
      ) : (
        <div className="note">
          <span>ℹ️</span>
          <span>{s.message ?? "No usage data available."}</span>
        </div>
      )}

      <div className="svc-meta">
        <div><div className="k">Remaining</div><div className="v tnum">{s.usage != null && s.limit != null ? fmtNum(s.limit - s.usage) : "—"}</div></div>
        <div><div className="k">Renewal</div><div className="v">{fmtDate(s.renewalISO)}</div></div>
        <div><div className="k">Days left</div><div className="v tnum" style={{ color: daysColor }}>{d != null ? d + "d" : "—"}</div></div>
        <div>
          <div className="k">Alert</div>
          <div className="v"><span className={"badge " + alertCls} style={{ padding: "2px 8px" }}><span className="bd" />{alertTxt}</span></div>
        </div>
      </div>

      <div className="thr">
        <label htmlFor={`thr-${s.id}`}>Alert threshold</label>
        <input id={`thr-${s.id}`} type="range" min={10} max={95} step={5} value={threshold}
          onChange={(e) => onThreshold(s.id, Number(e.target.value))} />
        <span className="tval mono">{threshold}%</span>
      </div>
    </div>
  );
}
