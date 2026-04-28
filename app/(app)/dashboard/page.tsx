import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <PlaceholderPage
      title="Dashboard"
      description="Revenue overview, trends, and key metrics will live here."
    />
  );
}
