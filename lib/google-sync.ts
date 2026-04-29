/**
 * Google data sync — Gmail + Calendar → contact network.
 *
 * Pipeline:
 *   1. Fetch last 90 days of sent + received Gmail messages (metadata only)
 *   2. Fetch last 90 days of Calendar events
 *   3. Extract contacts: email, name, domain, company name
 *   4. Aggregate per-contact: sent_count, received_count, meeting_count,
 *      first/last interaction timestamps
 *   5. Score each contact: frequency × recency × directionality
 *   6. Detect opportunity signals in subject lines / event titles
 *   7. Persist contacts + signal interactions to DB
 *
 * Free-email domains are excluded from the contact list. The user's own
 * domain is kept but flagged so the UI can show "internal" contacts.
 */

import {
  FREE_EMAIL_DOMAINS,
  NOTIFICATION_DOMAINS,
  NO_REPLY_RE,
  shouldSkipContact,
  domainFromEmail,
} from "./contact-filter"
import { computeRelationshipStrength } from "./contact-graph"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GMAIL_BASE    = "https://gmail.googleapis.com/gmail/v1"
const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3"

const SYNC_WINDOW_DAYS  = 90
const MAX_MESSAGES_SENT = 500
const MAX_MESSAGES_RECV = 500
const MAX_EVENTS        = 500
/** Parallel fetch concurrency when loading message metadata. */
const FETCH_CONCURRENCY = 20

// shouldSkipContact, NO_REPLY_RE, NOTIFICATION_DOMAINS, FREE_EMAIL_DOMAINS,
// and domainFromEmail are all imported from ./contact-filter above.

// ---------------------------------------------------------------------------
// Opportunity signal detection
// ---------------------------------------------------------------------------

const OPPORTUNITY_KEYWORDS: Record<string, RegExp> = {
  hiring:  /\b(hiring|we(?:'re| are) hiring|open(?:ing)? (?:a )?role|new (?:hire|opening)|join(?:ing)? (?:our )?team|looking for (?:a )?(?:designer|developer|engineer|marketer|writer))\b/i,
  launch:  /\b(launch(?:ing|ed)?|new (?:product|feature|release)|announ(?:cing|ced)|just (?:released|shipped)|(?:beta|alpha) (?:access|launch)|going live)\b/i,
  project: /\b(new project|project (?:kick ?off|brief|proposal)|scope of work|sow|rfp|brief|discovery call)\b/i,
  budget:  /\b(budget|proposal|quote|pricing|investment|rate card|retainer|cost estimate)\b/i,
  agency:  /\b(agency|freelancer|consultant|need (?:help|support|a partner)|looking for help|partner(?:ship)?|collaboration)\b/i,
}

function detectOpportunitySignals(text: string): string[] {
  return Object.entries(OPPORTUNITY_KEYWORDS)
    .filter(([, re]) => re.test(text))
    .map(([key]) => key)
}

// ---------------------------------------------------------------------------
// Email address parsing
// ---------------------------------------------------------------------------

interface ParsedAddress {
  email: string
  name:  string | null
}

/**
 * Parses RFC 5322 address header values.
 * Handles: "Name <email>", "<email>", "email", comma-separated lists.
 */
function parseAddressHeader(value: string): ParsedAddress[] {
  const results: ParsedAddress[] = []
  if (!value) return results

  // Split on commas that are NOT inside angle brackets or quoted strings.
  // Simple heuristic: split on ", " patterns that are followed by a capital or email-start.
  const parts = value.split(/,(?=\s*(?:[A-Za-z"<]|\S+@))/)

  for (const raw of parts) {
    const trimmed = raw.trim()
    if (!trimmed) continue

    // "Name <email@domain.com>"
    const angleMatch = trimmed.match(/^"?([^"<>]*?)"?\s*<([^>]+)>$/)
    if (angleMatch) {
      const email = angleMatch[2].toLowerCase().trim()
      const name  = angleMatch[1].trim().replace(/^"|"$/g, "") || null
      if (email.includes("@")) results.push({ email, name: name || null })
      continue
    }

    // Bare "email@domain.com"
    if (trimmed.includes("@") && !trimmed.includes(" ")) {
      results.push({ email: trimmed.toLowerCase(), name: null })
    }
  }

  return results
}

/**
 * Converts a domain to a human-readable company name.
 *   "bright-data.io"  → "Bright Data"
 *   "stripe.com"      → "Stripe"
 *   "a.b.stripe.com"  → "Stripe"  (uses second-level domain)
 */
export function domainToCompanyName(domain: string): string {
  // Strip common TLDs and subdomains — use second-level label
  const parts  = domain.replace(/\.(com|io|co|net|org|app|dev|ai|xyz|so|gg|me)$/, "").split(".")
  const label  = parts[parts.length - 1] ?? domain
  return label
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

// ---------------------------------------------------------------------------
// Contact accumulator
// ---------------------------------------------------------------------------

/**
 * One message in a Gmail thread that is relevant to a contact.
 * Used to compute reply-time and who-initiates metrics.
 */
interface ThreadMessage {
  /** True when the account holder sent this message; false when the contact did. */
  senderIsUser: boolean
  /** Unix milliseconds — from internalDate. */
  timestamp: number
}

interface ContactAccum {
  email:            string
  name:             string | null
  domain:           string
  companyName:      string
  sentCount:        number
  receivedCount:    number
  meetingCount:     number
  firstInteraction: Date
  lastInteraction:  Date
  /**
   * Thread-level message sequences, keyed by Gmail threadId.
   * Populated only for email (not meetings) and only when threadId is available.
   * Used to derive threadCount, avgReplyTimeHours, and whoInitiates.
   */
  threads:          Map<string, ThreadMessage[]>
}

type ContactMap = Map<string, ContactAccum>

function touchContact(
  map:          ContactMap,
  addr:         ParsedAddress,
  when:         Date,
  type:         "sent" | "received" | "meeting",
  threadInfo?:  { threadId: string; senderIsUser: boolean },
): void {
  const email = addr.email.toLowerCase()
  const domain = domainFromEmail(email)
  if (!domain || !domain.includes(".")) return

  const existing = map.get(email)
  if (existing) {
    if (type === "sent")     existing.sentCount++
    if (type === "received") existing.receivedCount++
    if (type === "meeting")  existing.meetingCount++
    if (when < existing.firstInteraction) existing.firstInteraction = when
    if (when > existing.lastInteraction)  existing.lastInteraction  = when
    if (!existing.name && addr.name) existing.name = addr.name

    // Append to thread message list
    if (threadInfo) {
      const msgs = existing.threads.get(threadInfo.threadId) ?? []
      msgs.push({ senderIsUser: threadInfo.senderIsUser, timestamp: when.getTime() })
      existing.threads.set(threadInfo.threadId, msgs)
    }
  } else {
    const threads = new Map<string, ThreadMessage[]>()
    if (threadInfo) {
      threads.set(threadInfo.threadId, [
        { senderIsUser: threadInfo.senderIsUser, timestamp: when.getTime() },
      ])
    }
    map.set(email, {
      email,
      name:             addr.name,
      domain,
      companyName:      domainToCompanyName(domain),
      sentCount:        type === "sent"     ? 1 : 0,
      receivedCount:    type === "received" ? 1 : 0,
      meetingCount:     type === "meeting"  ? 1 : 0,
      firstInteraction: when,
      lastInteraction:  when,
      threads,
    })
  }
}

// ---------------------------------------------------------------------------
// Thread-derived relationship metrics
// ---------------------------------------------------------------------------

/**
 * Derives `threadCount`, `avgReplyTimeHours`, and `whoInitiates` from
 * the per-thread message sequences captured during Gmail processing.
 *
 * Reply-time algorithm:
 *   For each thread with ≥2 messages, sort by timestamp, then find consecutive
 *   message pairs where the sender alternates (user ↔ contact).  The time gap
 *   between each alternating pair is one "reply event".  Average all reply
 *   events across all threads for this contact.
 *
 * Who-initiates algorithm:
 *   The first message in each thread identifies the initiator.
 *   If >70% of threads were started by the user → "user"
 *   If >70% of threads were started by the contact → "them"
 *   Otherwise → "mixed"
 */
function computeThreadMetrics(threads: Map<string, ThreadMessage[]>): {
  threadCount:       number
  avgReplyTimeHours: number | null
  whoInitiates:      "user" | "them" | "mixed" | null
} {
  const threadCount = threads.size
  if (threadCount === 0) {
    return { threadCount: 0, avgReplyTimeHours: null, whoInitiates: null }
  }

  const replyDelaysMs: number[] = []
  let userInitiated = 0
  let themInitiated = 0

  for (const msgs of threads.values()) {
    if (msgs.length < 1) continue

    // Sort chronologically
    const sorted = [...msgs].sort((a, b) => a.timestamp - b.timestamp)

    // Who-initiates: first message in thread
    if (sorted[0].senderIsUser) userInitiated++
    else                        themInitiated++

    // Reply-time: consecutive pairs where sender alternates
    if (sorted.length < 2) continue
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const curr = sorted[i]
      // Only count when sender flips (genuine reply, not two back-to-back from same side)
      if (prev.senderIsUser !== curr.senderIsUser) {
        replyDelaysMs.push(curr.timestamp - prev.timestamp)
      }
    }
  }

  const avgReplyTimeHours =
    replyDelaysMs.length > 0
      ? Math.round(
          (replyDelaysMs.reduce((a, b) => a + b, 0) / replyDelaysMs.length / 3_600_000) * 10,
        ) / 10
      : null

  const totalThreadsWithKnownInitiator = userInitiated + themInitiated
  let whoInitiates: "user" | "them" | "mixed" | null = null
  if (totalThreadsWithKnownInitiator > 0) {
    const userRatio = userInitiated / totalThreadsWithKnownInitiator
    whoInitiates =
      userRatio >= 0.7 ? "user"
      : userRatio <= 0.3 ? "them"
      : "mixed"
  }

  return { threadCount, avgReplyTimeHours, whoInitiates }
}

// ---------------------------------------------------------------------------
// Interaction score
// ---------------------------------------------------------------------------

/**
 * interaction_score = base × recency × frequency
 *
 * base      = sent×1.0 + received×0.8 + meetings×2.0
 * recency   = 1.0 if ≤14d, 0.85 if ≤30d, 0.60 if ≤60d, 0.35 if ≤90d
 * frequency = 1.4 if >20 total, 1.2 if >10, 1.1 if >5, else 1.0
 */
export function computeInteractionScore(c: ContactAccum): number {
  const base = c.sentCount * 1.0 + c.receivedCount * 0.8 + c.meetingCount * 2.0
  if (base === 0) return 0

  const daysAgo = (Date.now() - c.lastInteraction.getTime()) / (1000 * 60 * 60 * 24)
  const recency  = daysAgo <= 14 ? 1.0 : daysAgo <= 30 ? 0.85 : daysAgo <= 60 ? 0.60 : 0.35

  const total     = c.sentCount + c.receivedCount + c.meetingCount
  const frequency = total > 20 ? 1.4 : total > 10 ? 1.2 : total > 5 ? 1.1 : 1.0

  return Math.round(base * recency * frequency * 100) / 100
}

// ---------------------------------------------------------------------------
// Gmail fetch
// ---------------------------------------------------------------------------

interface GmailMessageStub { id: string }

async function listGmailMessageIds(
  accessToken: string,
  query:       string,
  maxResults:  number,
): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined

  while (ids.length < maxResults) {
    const params = new URLSearchParams({
      q:          query,
      maxResults: String(Math.min(500, maxResults - ids.length)),
    })
    if (pageToken) params.set("pageToken", pageToken)

    const res = await fetch(`${GMAIL_BASE}/users/me/messages?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) break

    const data = await res.json() as {
      messages?:      GmailMessageStub[]
      nextPageToken?: string
    }
    for (const m of data.messages ?? []) ids.push(m.id)
    pageToken = data.nextPageToken
    if (!pageToken) break
  }

  return ids
}

interface GmailMetadata {
  id:           string
  threadId?:    string   // always returned by Gmail API — captures conversation threads
  internalDate: string
  payload?: {
    headers?: Array<{ name: string; value: string }>
  }
}

async function fetchMessageMetadata(
  accessToken: string,
  id:          string,
): Promise<GmailMetadata | null> {
  const params = new URLSearchParams({
    format:          "metadata",
    metadataHeaders: ["From", "To", "Cc", "Subject"].join(","),
  })
  // metadataHeaders must be repeated, not comma-joined
  const url =
    `${GMAIL_BASE}/users/me/messages/${id}` +
    `?format=metadata` +
    `&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  return res.json()
}

/** Runs `fn` over `items` in parallel batches of `size`. */
async function batchProcess<T, R>(
  items:   T[],
  size:    number,
  fn:      (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size)
    results.push(...await Promise.all(batch.map(fn)))
  }
  return results
}

// ---------------------------------------------------------------------------
// Calendar fetch
// ---------------------------------------------------------------------------

interface CalendarEvent {
  id:       string
  summary?: string
  start:    { dateTime?: string; date?: string }
  attendees?: Array<{ email: string; displayName?: string; self?: boolean }>
  organizer?: { email: string; self?: boolean }
}

async function fetchCalendarEvents(
  accessToken: string,
  since:       Date,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin:       since.toISOString(),
    timeMax:       new Date().toISOString(),
    maxResults:    String(MAX_EVENTS),
    singleEvents:  "true",
    orderBy:       "startTime",
  })

  const res = await fetch(`${CALENDAR_BASE}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return []

  const data = await res.json() as { items?: CalendarEvent[] }
  return data.items ?? []
}

// ---------------------------------------------------------------------------
// DB row shapes
// ---------------------------------------------------------------------------

export interface ContactRow {
  email:             string
  name:              string | null
  domain:            string
  companyName:       string
  sentCount:         number
  receivedCount:     number
  meetingCount:      number
  firstInteraction:  string  // ISO
  lastInteraction:   string  // ISO
  interactionScore:  number
  // ── Relationship graph fields ─────────────────────────────────────────────
  threadCount:       number
  avgReplyTimeHours: number | null
  whoInitiates:      "user" | "them" | "mixed" | null
  relationshipStrength: "strong" | "warm" | "cold"
}

export interface ContactInteractionRow {
  contactEmail:        string
  interactionType:     "email_sent" | "email_received" | "meeting"
  subject:             string
  occurredAt:          string  // ISO
  externalId:          string
  opportunitySignals:  string[]
}

// ---------------------------------------------------------------------------
// Debug counts
// ---------------------------------------------------------------------------

export interface SyncDebugCounts {
  /** Unique business emails extracted from Gmail sent + received (after filter). */
  gmailContactsFound:    number
  /** Unique business emails extracted from Calendar attendees (after filter). */
  calendarContactsFound: number
  /**
   * Always 0 — Cavro builds contacts entirely from interaction history.
   * The Google People API (saved contacts) is intentionally not used.
   */
  savedContactsFound:    number
  /** Total unique contacts persisted (merged across all sources). */
  contactsAfterFilter:   number
  /** Signal-matched interactions persisted (only hiring/launch/project/budget/agency). */
  interactionsSaved:     number
}

// ---------------------------------------------------------------------------
// Public sync function
// ---------------------------------------------------------------------------

export interface SyncResult {
  contactsProcessed:    number
  contactsUpserted:     number
  interactionsUpserted: number
  durationMs:           number
}

/**
 * Fetches the last 90 days of Gmail + Calendar data, extracts contacts,
 * scores them, and returns structured rows for DB persistence.
 *
 * Contact sources:
 *   - Gmail sent mail   → To / Cc addresses
 *   - Gmail inbox       → From addresses
 *   - Calendar events   → attendee list
 *   - Google People API → NOT used (contacts come from interaction history only)
 *
 * Never throws — errors are caught and logged per-step.
 */
export async function syncGoogleData(
  accessToken: string,
  userEmail:   string,
): Promise<{ contacts: ContactRow[]; interactions: ContactInteractionRow[]; debug: SyncDebugCounts }> {
  const since = new Date(Date.now() - SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const sinceStr = since.toISOString().split("T")[0].replace(/-/g, "/")
  const userDomain = domainFromEmail(userEmail)

  const contactMap: ContactMap = new Map()
  const interactions: ContactInteractionRow[] = []

  // Per-source tracking (unique emails that passed the filter)
  const gmailEmailsKept    = new Set<string>()
  const calendarEmailsKept = new Set<string>()

  // ── Sent mail ─────────────────────────────────────────────────────────────
  let sentIds: string[] = []
  try {
    sentIds = await listGmailMessageIds(
      accessToken,
      `in:sent after:${sinceStr}`,
      MAX_MESSAGES_SENT,
    )
  } catch (err) {
    console.error("GOOGLE SYNC: sent message list failed —", err)
  }

  let gmailSentKept = 0
  if (sentIds.length > 0) {
    const metas = await batchProcess(
      sentIds,
      FETCH_CONCURRENCY,
      (id) => fetchMessageMetadata(accessToken, id).catch(() => null),
    )

    for (const meta of metas) {
      if (!meta?.payload?.headers) continue
      const headers = Object.fromEntries(
        (meta.payload.headers ?? []).map((h) => [h.name, h.value]),
      )
      const when    = new Date(Number(meta.internalDate))
      const subject = headers["Subject"] ?? ""
      const toAddrs = [
        ...parseAddressHeader(headers["To"] ?? ""),
        ...parseAddressHeader(headers["Cc"] ?? ""),
      ]

      for (const addr of toAddrs) {
        if (shouldSkipContact(addr.email, userDomain)) continue
        touchContact(contactMap, addr, when, "sent", meta.threadId
          ? { threadId: meta.threadId, senderIsUser: true }
          : undefined)
        if (!gmailEmailsKept.has(addr.email)) {
          gmailEmailsKept.add(addr.email)
          gmailSentKept++
        }

        const signals = detectOpportunitySignals(subject)
        if (signals.length > 0) {
          interactions.push({
            contactEmail:       addr.email,
            interactionType:    "email_sent",
            subject,
            occurredAt:         when.toISOString(),
            externalId:         `${meta.id}:${addr.email}`,
            opportunitySignals: signals,
          })
        }
      }
    }
  }

  // ── Received mail ──────────────────────────────────────────────────────────
  let recvIds: string[] = []
  try {
    recvIds = await listGmailMessageIds(
      accessToken,
      `in:inbox -from:me after:${sinceStr}`,
      MAX_MESSAGES_RECV,
    )
  } catch (err) {
    console.error("GOOGLE SYNC: received message list failed —", err)
  }

  let gmailRecvKept = 0
  if (recvIds.length > 0) {
    const metas = await batchProcess(
      recvIds,
      FETCH_CONCURRENCY,
      (id) => fetchMessageMetadata(accessToken, id).catch(() => null),
    )

    for (const meta of metas) {
      if (!meta?.payload?.headers) continue
      const headers = Object.fromEntries(
        (meta.payload.headers ?? []).map((h) => [h.name, h.value]),
      )
      const when    = new Date(Number(meta.internalDate))
      const subject = headers["Subject"] ?? ""
      const from    = parseAddressHeader(headers["From"] ?? "")

      for (const addr of from) {
        if (shouldSkipContact(addr.email, userDomain)) continue
        touchContact(contactMap, addr, when, "received", meta.threadId
          ? { threadId: meta.threadId, senderIsUser: false }
          : undefined)
        if (!gmailEmailsKept.has(addr.email)) {
          gmailEmailsKept.add(addr.email)
          gmailRecvKept++
        }

        const signals = detectOpportunitySignals(subject)
        if (signals.length > 0) {
          interactions.push({
            contactEmail:       addr.email,
            interactionType:    "email_received",
            subject,
            occurredAt:         when.toISOString(),
            externalId:         `${meta.id}:${addr.email}`,
            opportunitySignals: signals,
          })
        }
      }
    }
  }

  // ── Calendar events ────────────────────────────────────────────────────────
  let events: CalendarEvent[] = []
  try {
    events = await fetchCalendarEvents(accessToken, since)
  } catch (err) {
    console.error("GOOGLE SYNC: calendar fetch failed —", err)
  }

  for (const event of events) {
    const when = new Date(event.start.dateTime ?? event.start.date ?? "")
    if (isNaN(when.getTime())) continue
    const title = event.summary ?? ""

    for (const attendee of event.attendees ?? []) {
      if (attendee.self) continue
      const addr: ParsedAddress = {
        email: attendee.email.toLowerCase(),
        name:  attendee.displayName ?? null,
      }
      if (shouldSkipContact(addr.email, userDomain)) continue
      touchContact(contactMap, addr, when, "meeting")
      calendarEmailsKept.add(addr.email)

      const signals = detectOpportunitySignals(title)
      if (signals.length > 0) {
        interactions.push({
          contactEmail:       addr.email,
          interactionType:    "meeting",
          subject:            title,
          occurredAt:         when.toISOString(),
          externalId:         `cal:${event.id}:${addr.email}`,
          opportunitySignals: signals,
        })
      }
    }
  }

  // ── Build contact rows ─────────────────────────────────────────────────────
  const contacts: ContactRow[] = []
  for (const [, accum] of contactMap) {
    const { threadCount, avgReplyTimeHours, whoInitiates } = computeThreadMetrics(accum.threads)
    const lastInteractionISO = accum.lastInteraction.toISOString()

    contacts.push({
      email:             accum.email,
      name:              accum.name,
      domain:            accum.domain,
      companyName:       accum.companyName,
      sentCount:         accum.sentCount,
      receivedCount:     accum.receivedCount,
      meetingCount:      accum.meetingCount,
      firstInteraction:  accum.firstInteraction.toISOString(),
      lastInteraction:   lastInteractionISO,
      interactionScore:  computeInteractionScore(accum),
      threadCount,
      avgReplyTimeHours,
      whoInitiates,
      relationshipStrength: computeRelationshipStrength({
        sentCount:       accum.sentCount,
        receivedCount:   accum.receivedCount,
        meetingCount:    accum.meetingCount,
        lastInteraction: lastInteractionISO,
      }),
    })
  }

  // Deduplicate interactions by externalId (same message processed in both sent + recv)
  const seenInteractionIds = new Set<string>()
  const dedupedInteractions = interactions.filter((i) => {
    if (seenInteractionIds.has(i.externalId)) return false
    seenInteractionIds.add(i.externalId)
    return true
  })

  const debug: SyncDebugCounts = {
    gmailContactsFound:    gmailEmailsKept.size,
    calendarContactsFound: calendarEmailsKept.size,
    savedContactsFound:    0,  // People API not used — contacts from interaction history only
    contactsAfterFilter:   contacts.length,
    interactionsSaved:     dedupedInteractions.length,
  }

  console.log(
    `GOOGLE SYNC [${userEmail}] breakdown:\n` +
    `  Gmail (sent):     ${sentIds.length} msgs → ${gmailSentKept} new unique contacts kept\n` +
    `  Gmail (received): ${recvIds.length} msgs → ${gmailRecvKept} new unique contacts kept\n` +
    `  Gmail total:      ${debug.gmailContactsFound} unique business emails\n` +
    `  Calendar:         ${events.length} events → ${debug.calendarContactsFound} unique attendees kept\n` +
    `  Saved contacts:   0 (People API not used)\n` +
    `  ─────────────────────────────────────────\n` +
    `  Contacts total:   ${debug.contactsAfterFilter} (after cross-source dedup)\n` +
    `  Interactions:     ${debug.interactionsSaved} (signal-matched only)`,
  )

  return { contacts, interactions: dedupedInteractions, debug }
}
