import type { Metadata } from "next"
import { PromptsClient } from "./prompts-client"

export const metadata: Metadata = { title: "Prompts — Kaelor AI" }

export default function PromptsPage() {
  return <PromptsClient />
}
