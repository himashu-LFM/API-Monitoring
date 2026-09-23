import { PageHeader } from "@/components/common/page-header";
import { SettingsView } from "@/components/settings/settings-view";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Account, notifications and monitoring preferences." />
      <SettingsView />
    </>
  );
}
