"use server"

import { after } from "next/server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import {
  createClient,
  createAnalysis,
  getClientById,
  getAnalysisByClientId,
  updateAnalysis,
  updateClient,
} from "@/lib/db"
import { gatherSignals } from "@/lib/signals"
import { analyzeWebsite } from "@/lib/ai"
import { detectChanges, summarizeChanges } from "@/lib/diff"
import type { RelationshipType, ClientContact } from "@/lib/types"

export async function addClient(
  name: string,
  websiteUrl: string
): Promise<{ clientId: string }> {
  if (!name || !websiteUrl) throw new Error("Name and website are required")

  const client = await createClient({ name, websiteUrl })

  const analysis = await createAnalysis({
    clientId: client.id,
    status: "pending",
    summary: "",
    strategicDirection: [],
    opportunities: [],
    suggestedPitch: "",
  })

  after(async () => {
    try {
      const freshClient = await getClientById(client.id)
      const signals = await gatherSignals(websiteUrl)
      const result = await analyzeWebsite(websiteUrl, signals, [], freshClient ?? client)
      await updateAnalysis(analysis.id, {
        ...result,
        status: "complete",
        signals,
        changes: [],
        lastAnalyzedAt: new Date().toISOString(),
      })
    } catch (err) {
      await updateAnalysis(analysis.id, {
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Analysis failed",
      })
    }
  })

  return { clientId: client.id }
}

/**
 * FormData-compatible wrapper for use as a <form action>.
 * Extracts name and websiteUrl from the submitted form, then redirects to the client page.
 */
export async function addClientFromForm(formData: FormData): Promise<void> {
  const name = (formData.get("name") as string | null)?.trim() ?? ""
  const websiteUrl = (formData.get("websiteUrl") as string | null)?.trim() ?? ""
  const { clientId } = await addClient(name, websiteUrl)
  redirect(`/clients/${clientId}`)
}

export async function bulkAddClients(
  clients: Array<{ name: string; websiteUrl: string }>
): Promise<{ added: number }> {
  let added = 0

  for (const { name, websiteUrl } of clients) {
    try {
      if (!name.trim() || !websiteUrl.trim()) continue
      const url = websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`
      const client = await createClient({ name: name.trim(), websiteUrl: url })
      const analysis = await createAnalysis({
        clientId: client.id,
        status: "pending",
        summary: "",
        strategicDirection: [],
        opportunities: [],
        suggestedPitch: "",
      })
      after(async () => {
        try {
          const freshClient = await getClientById(client.id)
          const signals = await gatherSignals(url)
          const result = await analyzeWebsite(url, signals, [], freshClient ?? client)
          await updateAnalysis(analysis.id, {
            ...result,
            status: "complete",
            signals,
            changes: [],
            lastAnalyzedAt: new Date().toISOString(),
          })
        } catch (err) {
          await updateAnalysis(analysis.id, {
            status: "error",
            errorMessage: err instanceof Error ? err.message : "Analysis failed",
          })
        }
      })
      added++
    } catch {
      // skip invalid entries silently
    }
  }

  revalidatePath("/clients")
  return { added }
}

export async function detectClientsFromWebsite(
  rawUrl: string
): Promise<Array<{ name: string; websiteUrl: string }>> {
  const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []

    const html = await res.text()
    const results: Array<{ name: string; websiteUrl: string }> = []
    const seen = new Set<string>()

    const STOP_WORDS =
      /^(the|a|an|and|or|we|our|they|their|this|that|these|those|it|is|are|was|were|be|been|have|has|do|does|will|would|could|should|may|might|can|logo|image|icon|photo|banner|button|menu|link|more|next|prev|close|open)$/i

    function tryAdd(name: string, website = "") {
      const clean = name
        .trim()
        .replace(/\s+/g, " ")
        .replace(/^(the|a|an)\s+/i, "")
        .replace(/[.,;:!?]+$/, "")
      if (
        clean.length < 2 ||
        clean.length > 50 ||
        seen.has(clean.toLowerCase()) ||
        STOP_WORDS.test(clean) ||
        /\d{4}/.test(clean)
      )
        return
      seen.add(clean.toLowerCase())
      results.push({ name: clean, websiteUrl: website })
    }

    // 1. Image alt text — client logo carousels almost always use company names here
    for (const m of html.matchAll(/<img[^>]+alt=["']([^"']{2,50})["'][^>]*>/gi)) {
      const alt = m[1].trim()
      if (
        /^[A-Z][A-Za-z0-9]+([ &.\-][A-Za-z0-9]+)*$/.test(alt) &&
        !/screenshot|photo|banner|background|graphic|placeholder|illustration/i.test(alt)
      ) {
        tryAdd(alt)
      }
    }

    // 2. data-* attributes used by logo/partner sections
    for (const m of html.matchAll(
      /data-(?:company|client|partner|customer|name)=["']([^"']{2,50})["']/gi
    )) {
      tryAdd(m[1])
    }

    // 3. Sections with class/id names suggesting clients or case studies
    const stripTags = (s: string) =>
      s
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()

    for (const m of html.matchAll(
      /<(?:section|div|article)[^>]*(?:class|id)=["'][^"']*(?:client|customer|partner|case.?study|testimonial|logo)[^"']*["'][^>]*>([\s\S]{0,3000}?)<\/(?:section|div|article)>/gi
    )) {
      const text = stripTags(m[1])
      for (const nm of text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g)) {
        if (!STOP_WORDS.test(nm[1])) tryAdd(nm[1])
        if (results.length >= 12) break
      }
      if (results.length >= 12) break
    }

    return results.slice(0, 8)
  } catch {
    return []
  }
}

export interface ClientContext {
  relationshipType?: RelationshipType
  services?: string[]
  contact?: ClientContact
  focus?: string
  connections?: string[]
}

export async function updateClientContext(
  clientId: string,
  context: ClientContext
): Promise<void> {
  await updateClient(clientId, context)
}

export async function reanalyzeClient(clientId: string) {
  const [client, prevAnalysis] = await Promise.all([
    getClientById(clientId),
    getAnalysisByClientId(clientId),
  ])

  if (!client || !prevAnalysis) throw new Error("Client not found")

  const prevSignals = prevAnalysis.signals

  await updateAnalysis(prevAnalysis.id, {
    status: "pending",
    summary: "",
    strategicDirection: [],
    opportunities: [],
    suggestedPitch: "",
  })

  after(async () => {
    try {
      const signals = await gatherSignals(client.websiteUrl)
      const changes = prevSignals ? detectChanges(prevSignals, signals) : []
      const changeSummary = summarizeChanges(changes)
      const result = await analyzeWebsite(client.websiteUrl, signals, changes, client)
      await updateAnalysis(prevAnalysis.id, {
        ...result,
        status: "complete",
        signals,
        lastSignals: prevSignals,
        changes,
        changeSummary,
        lastAnalyzedAt: new Date().toISOString(),
      })
    } catch (err) {
      await updateAnalysis(prevAnalysis.id, {
        status: "error",
        errorMessage: err instanceof Error ? err.message : "Analysis failed",
      })
    }
  })

  redirect(`/clients/${client.id}`)
}
