import type { Metadata } from "next"
import { PerceptionClient } from "./perception-client"

export const metadata: Metadata = { title: "AI Perception — Cavro AI" }

export default function PerceptionPage() {
  return <PerceptionClient />
}
