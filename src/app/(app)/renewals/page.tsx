import { PageHeader } from "@/components/common/page-header";
import { RenewalsView } from "@/components/renewals/renewals-view";

export default function RenewalsPage() {
  return (
    <>
      <PageHeader title="Renewals" subtitle="Billing cycle reset dates across services." />
      <RenewalsView />
    </>
  );
}
