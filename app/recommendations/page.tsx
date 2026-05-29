import type { Metadata } from "next"
import { RecommendationsClient } from "./recommendations-client"

export const metadata: Metadata = { title: "Recommendations — Kaelor AI" }

export default function RecommendationsPage() {
  return <RecommendationsClient />
}
