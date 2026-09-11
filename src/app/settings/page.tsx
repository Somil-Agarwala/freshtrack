import { PageHeader } from "@/components/ui/page-header";
import { SettingsForm } from "@/components/settings/settings-form";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Your profile, packing rules and reminders" />
      <SettingsForm />
    </div>
  );
}
