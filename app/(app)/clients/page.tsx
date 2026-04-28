import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export const metadata: Metadata = { title: "Clients" };

export default function ClientsPage() {
  return (
    <PlaceholderPage
      title="Clients"
      description="Client list, profiles, and revenue details will live here."
    />
  );
}
