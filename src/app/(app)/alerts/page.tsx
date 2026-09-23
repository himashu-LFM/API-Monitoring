import { PageHeader } from "@/components/common/page-header";
import { AlertsView } from "@/components/alerts/alerts-view";

export default function AlertsPage() {
  return (
    <>
      <PageHeader title="Alerts" subtitle="Threshold, anomaly and renewal alerts across your services." />
      <AlertsView />
    </>
  );
}
