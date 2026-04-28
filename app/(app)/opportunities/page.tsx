import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export const metadata: Metadata = { title: "Opportunities" };

export default function OpportunitiesPage() {
  return (
    <PlaceholderPage
      title="Opportunities"
      description="Pipeline, open opportunities, and forecasts will live here."
    />
  );
}
