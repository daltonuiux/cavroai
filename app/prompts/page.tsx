import type { Metadata } from "next"
import { PromptsClient } from "./prompts-client"

export const metadata: Metadata = { title: "Prompts — Cavro AI" }

export default function PromptsPage() {
  return <PromptsClient />
}
