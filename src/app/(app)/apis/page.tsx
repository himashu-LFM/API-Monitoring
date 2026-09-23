import { PageHeader } from "@/components/common/page-header";
import { ApisView } from "@/components/apis/apis-view";

export default function ApisPage() {
  return (
    <>
      <PageHeader title="APIs" subtitle="Monitor usage, limits and renewals." />
      <ApisView />
    </>
  );
}
