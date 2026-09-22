import type { Alert } from "@/lib/types";

const ICON: Record<Alert["severity"], string> = { crit: "🔴", warn: "🟡", info: "🔔" };
const BG: Record<Alert["severity"], string> = {
  crit: "var(--crit-bg)", warn: "var(--warn-bg)", info: "var(--info-bg)",
};

export default function AlertList({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return <div className="note"><span>✅</span><span>No active alerts — everything is within its threshold.</span></div>;
  }
  return (
    <>
      {alerts.map((a) => (
        <div className="arow" key={a.id}>
          <span className="ai" style={{ background: BG[a.severity] }}>{ICON[a.severity]}</span>
          <div>
            <div className="t">{a.title}</div>
            <div className="m">{a.timeLabel}</div>
          </div>
        </div>
      ))}
    </>
  );
}
