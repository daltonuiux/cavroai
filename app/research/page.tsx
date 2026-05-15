import type { Metadata } from "next"
import { ResearchClient } from "./research-client"

export const metadata: Metadata = { title: "Research — Cavro AI" }

type Props = {
  searchParams: Promise<{ tab?: string }>
}

export default async function ResearchPage({ searchParams }: Props) {
  const { tab } = await searchParams
  const validTabs = ["prompts", "audits", "competitors"]
  const initialTab = validTabs.includes(tab ?? "") ? (tab as "prompts" | "audits" | "competitors") : "prompts"

  return <ResearchClient key={initialTab} initialTab={initialTab} />
}
