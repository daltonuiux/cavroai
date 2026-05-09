import type { Metadata } from "next"
import { RecommendationsClient } from "./recommendations-client"

export const metadata: Metadata = { title: "Recommendations — Cavro AI" }

export default function RecommendationsPage() {
  return <RecommendationsClient />
}
