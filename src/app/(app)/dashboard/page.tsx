import { KpiRow } from "@/components/dashboard/kpi-row";
import { ServicesCard } from "@/components/dashboard/services-card";
import { UpcomingRenewals } from "@/components/dashboard/upcoming-renewals";

export default function DashboardPage() {
  return (
    <div className="space-y-5">
      <KpiRow />
      <ServicesCard />
      <UpcomingRenewals />
    </div>
  );
}
