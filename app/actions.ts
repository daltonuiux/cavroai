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
  const base = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`
  let origin: string
  try {
    origin = new URL(base).origin
  } catch {
    return []
  }

  // Paths to attempt in order — stop early once we have enough results
  const CANDIDATE_PATHS = [
    "/",
    "/customers",
    "/clients",
    "/case-studies",
    "/work",
    "/portfolio",
    "/testimonials",
    "/about",
  ]

  const STOP_WORDS =
    /^(the|a|an|and|or|we|our|they|their|this|that|these|those|it|is|are|was|were|be|been|have|has|do|does|will|would|could|should|may|might|can|logo|image|icon|photo|banner|button|menu|link|more|next|prev|close|open|get|see|read|learn|view|click|home|page|site|web|company|team|about|contact|work|services|blog|news|media|press|careers|jobs|privacy|terms|legal|copyright|all|rights|reserved|inc|llc|ltd|co|corp|you|your|with|for|in|on|at|to|by|of|from|into|through|during|before|after|above|below|between|out|off|over|under|again|further|then|once|here|there|when|where|why|how|what|which|who|whom|new|old|first|last|next|back|up|down|left|right|true|false)$/i

  const FALSE_POSITIVE_PATHS =
    /\/(pricing|blog|contact|login|signup|sign-up|register|terms|privacy|careers|jobs|services|features|docs|documentation|support|faq|help|download|install|resources|webinar|event)\b/i

  const seen = new Set<string>()
  const results: Array<{ name: string; websiteUrl: string }> = []

  function tryAdd(name: string, website = "") {
    const clean = name
      .trim()
      .replace(/\s+/g, " ")
      .replace(/^(the|a|an)\s+/i, "")
      .replace(/[.,;:!?'"()\[\]]+$/, "")
      .replace(/^[.,;:!?'"()\[\]]+/, "")
      .trim()
    if (
      clean.length < 2 ||
      clean.length > 60 ||
      seen.has(clean.toLowerCase()) ||
      STOP_WORDS.test(clean) ||
      /^\d+$/.test(clean) ||
      /\d{4}/.test(clean) ||
      clean.split(" ").length > 6
    )
      return
    seen.add(clean.toLowerCase())
    results.push({ name: clean, websiteUrl: website })
  }

  async function fetchPage(url: string): Promise<string | null> {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) return null
      return res.text()
    } catch {
      return null
    }
  }

  function stripTags(s: string): string {
    return s
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim()
  }

  function extractCandidates(html: string, pageUrl: string) {
    const isSubPage =
      /\/(customers?|clients?|case-studies?|work|portfolio|testimonials?|about)/.test(pageUrl)

    // 1. Image alt text — logo carousels almost always use company names as alt
    for (const m of html.matchAll(/<img[^>]+alt=["']([^"']{2,60})["'][^>]*>/gi)) {
      const alt = m[1].trim()
      if (
        !/screenshot|photo|banner|background|graphic|placeholder|illustration|avatar|headshot|portrait|arrow|chevron|star|check|icon|spinner|loader/i.test(
          alt
        )
      ) {
        tryAdd(alt)
      }
    }

    // 2. aria-label on links/images — e.g. "Acme Corp logo" or "Acme Corp homepage"
    for (const m of html.matchAll(/aria-label=["']([^"']{2,60})["']/gi)) {
      const label = m[1].trim()
      if (/logo|homepage|site/i.test(label)) {
        const name = label.replace(/\s+(logo|homepage|site|website)$/i, "").trim()
        if (name.length > 1) tryAdd(name)
      }
    }

    // 3. data-* attributes used by partner/customer sections
    for (const m of html.matchAll(
      /data-(?:company|client|partner|customer|name)=["']([^"']{2,60})["']/gi
    )) {
      tryAdd(m[1])
    }

    // 4. Sections with client/case-study/testimonial class or id names
    for (const m of html.matchAll(
      /<(?:section|div|article|ul|ol)[^>]*(?:class|id)=["'][^"']*(?:client|customer|partner|case.?study|testimonial|logo|work|portfolio)[^"']*["'][^>]*>([\s\S]{0,6000}?)<\/(?:section|div|article|ul|ol)>/gi
    )) {
      const text = stripTags(m[1])
      for (const nm of text.matchAll(
        /\b([A-Z][a-zA-Z0-9&.+]*(?:\s[A-Z][a-zA-Z0-9&.+]*){0,4})\b/g
      )) {
        if (!STOP_WORDS.test(nm[1])) tryAdd(nm[1])
        if (results.length >= 20) break
      }
    }

    // 5. Links to customer/case-study sub-pages — convert slug to title case
    for (const m of html.matchAll(
      /href=["']([^"']*\/(?:customers?|clients?|case-studies?|work|portfolio)\/([^/"'?#\s]{2,60}))[^"']*["']/gi
    )) {
      const path = m[1]
      const slug = m[2]
      if (!FALSE_POSITIVE_PATHS.test(path) && slug) {
        const name = slug
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .trim()
        tryAdd(name, origin)
      }
    }

    // 6. On sub-pages (/customers, /case-studies, etc.) treat short headings as company names
    if (isSubPage) {
      for (const m of html.matchAll(/<h[1-4][^>]*>([\s\S]{2,100}?)<\/h[1-4]>/gi)) {
        const text = stripTags(m[1]).trim()
        if (text.length >= 2 && text.length <= 60 && /^[A-Z]/.test(text)) {
          tryAdd(text)
        }
      }
    }
  }

  const attempted: string[] = []

  for (const path of CANDIDATE_PATHS) {
    if (results.length >= 10) break

    const pageUrl = origin + path
    attempted.push(pageUrl)

    const html = await fetchPage(pageUrl)
    if (html) {
      const before = results.length
      extractCandidates(html, pageUrl)
      console.log(
        `[detect] ${pageUrl} → +${results.length - before} candidates (total: ${results.length})`
      )
    } else {
      console.log(`[detect] ${pageUrl} → skipped (not reachable)`)
    }
  }

  const final = results.slice(0, 10)
  console.log(
    `[detect] done | URLs tried: ${attempted.length} | returning ${final.length}: [${final.map((r) => r.name).join(", ")}]`
  )
  return final
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
