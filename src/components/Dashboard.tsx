"use client";

import { useCallback, useEffect, useState } from "react";
import type { ServiceStatus, UsageResponse } from "@/lib/types";
import { deriveAlerts } from "@/lib/alerts";
import Sidebar from "./Sidebar";
import Kpis from "./Kpis";
import ServiceCard from "./ServiceCard";
import UsageChart from "./UsageChart";
import RenewalList from "./RenewalList";
import AlertList from "./AlertList";

const DEFAULT_THRESHOLD = 50;

export default function Dashboard() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [thresholds, setThresholds] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/usage", { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data: UsageResponse = await res.json();
      setServices(data.services);
      setFetchedAt(data.fetchedAt);
      setThresholds((prev) => {
        const next = { ...prev };
        for (const s of data.services) if (next[s.id] == null) next[s.id] = DEFAULT_THRESHOLD;
        return next;
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setThreshold = (id: string, value: number) =>
    setThresholds((prev) => ({ ...prev, [id]: value }));

  const toggleTheme = () => {
    const el = document.documentElement;
    const next = el.getAttribute("data-theme") === "dark" ? "light" : "dark";
    el.setAttribute("data-theme", next);
    try { localStorage.setItem("apimon-theme", next); } catch {}
  };

  const alerts = deriveAlerts(services, thresholds);
  const updatedLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div>
            <h1>Dashboard</h1>
            <div className="crumb">Live usage across all monitored services</div>
          </div>
          <div className="spacer" />
          <span className="updated">{loading ? "Refreshing…" : `Updated ${updatedLabel}`}</span>
          <button className="btn" onClick={load} disabled={loading}>↻ Refresh</button>
          <button className="btn icon" onClick={toggleTheme} title="Toggle theme">◐</button>
        </div>

        <div className="scroll">
          <div className="page">
            {error && (
              <div className="card"><div className="card-b note" style={{ margin: 0, border: "none" }}>
                <span>⚠️</span><span>Could not load usage: {error}</span>
              </div></div>
            )}

            {loading && services.length === 0 ? (
              <div className="card"><div className="card-b">Loading live usage…</div></div>
            ) : (
              <>
                <Kpis services={services} />

                <div className="card">
                  <div className="card-h">
                    <h3>Services</h3>
                    <span className="updated">Live data · configure keys in .env.local</span>
                  </div>
                  {services.map((s) => (
                    <ServiceCard key={s.id} service={s} threshold={thresholds[s.id] ?? DEFAULT_THRESHOLD} onThreshold={setThreshold} />
                  ))}
                </div>

                <div className="card">
                  <div className="card-h"><h3>Current usage</h3><span className="updated">Live %</span></div>
                  <div className="card-b"><UsageChart services={services} /></div>
                </div>

                <div className="two">
                  <div className="card">
                    <div className="card-h"><h3>Upcoming renewals</h3></div>
                    <div className="card-b" style={{ paddingTop: 4, paddingBottom: 6 }}>
                      <RenewalList services={services} />
                    </div>
                  </div>
                  <div className="card">
                    <div className="card-h"><h3>Active alerts</h3></div>
                    <div className="card-b" style={{ paddingTop: 4, paddingBottom: 6 }}>
                      <AlertList alerts={alerts} />
                    </div>
                  </div>
                </div>

                <footer>Live monitoring · alerts derived from current usage &amp; thresholds. Fill .env.local to connect each provider.</footer>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
