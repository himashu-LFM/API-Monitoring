import { KpiRow } from "@/components/dashboard/kpi-row";
import { ServicesCard } from "@/components/dashboard/services-card";
import { UsageOverview } from "@/components/dashboard/usage-overview";
import { UpcomingRenewals } from "@/components/dashboard/upcoming-renewals";
import { RecentAlerts } from "@/components/dashboard/recent-alerts";
import { UsageAnomalies } from "@/components/dashboard/usage-anomalies";

export default function DashboardPage() {
  return (
    <div className="space-y-5">
      <KpiRow />
      <ServicesCard />
      <UsageOverview />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <UsageAnomalies />
        <UpcomingRenewals />
      </div>
      <RecentAlerts />
    </div>
  );
}
