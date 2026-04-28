import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      description="Account, workspace, and integration settings will live here."
    />
  );
}
