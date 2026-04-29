/**
 * Surfaces — clusters of contacts organised around shared topics, signals, and events.
 *
 * A Surface represents a community or theme emerging from the user's network.
 * It answers "where should I show up?" and "who is active around what right now?"
 *
 * v1 algorithm
 * ────────────
 * 1. Filter contacts that have X enrichment data (twitterData != null)
 * 2. Classify each contact into ≤2 topic buckets (AI, SaaS, Design, etc.)
 *    by matching their tweet topics against bucket keyword lists
 * 3. Group contacts by bucket — discard buckets with fewer than MIN_CLUSTER_SIZE
 * 4. Within each group, aggregate signals + detect event mentions in tweet samples
 * 5. Score each surface (log(size) × signal_variety × event_boost)
 * 6. Generate title, description, and why-it-matters narrative
 * 7. Sort by strength desc, cap at MAX_SURFACES
 *
 * No DB writes. Pure read-time computation over Contact[] from the DB.
 */

import type { Contact, TwitterSignal, OpportunityType } from "./contact-graph"

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface ContactInSurface {
  email:            string
  name:             string | null
  companyName:      string
  domain:           string
  twitterHandle:    string
  signals:          TwitterSignal[]
  topics:           string[]
  bio:              string | null
  /** From Contact.interactionScore — used to classify relationship depth. */
  interactionScore: number
  /** From Contact.meetingCount — true "met in person" signal. */
  meetingCount:     number
}

/** Warmth tier derived from interaction history. */
export type RelationshipWarmth = "warm" | "email" | "cold"

/** Returns the warmth tier for a contact in a surface. */
export function contactWarmth(p: ContactInSurface): RelationshipWarmth {
  if (p.meetingCount > 0 || p.interactionScore >= 8) return "warm"
  if (p.interactionScore >= 3)                       return "email"
  return "cold"
}

/**
 * A compact representation of one opportunity that is linked to a Surface
 * because a contact in the surface's cluster works at that company.
 * Built in the page from CompanyOpportunityRow | PublicSignalOpportunityRow.
 */
export interface SurfaceOpportunity {
  company:         string
  domain:          string
  /** Human-readable label of the top signal (e.g. "Launching", "Fundraising"). */
  primarySignal:   string
  score:           number
  /** Which pipeline surfaced this opportunity. */
  source:          "contact" | "public_signal"
  /** Recommended action type derived from buyer + signal classification. */
  opportunityType: OpportunityType
  /** The "why now" narrative from the opportunity pipeline. */
  whyNow:          string
}

export interface SurfaceSignalSummary {
  /** TwitterSignal key, e.g. "launching" */
  type:  string
  /** Human-readable label, e.g. "Launching" */
  label: string
  /** How many contacts in this surface have this signal */
  count: number
}

/**
 * A compact reference to an event that shares people with this surface.
 * Populated by linkEventsToSurfaces() in the page, not by buildSurfaces().
 */
export interface EventRef {
  id:               string
  name:             string
  score:            number
  estimatedDate:    string | null
  location:         string | null
  /** How many people appear in both this surface and this event. */
  sharedPeopleCount: number
}

export interface Surface {
  /** Stable ID derived from the bucket key — safe for React keys. */
  id:            string
  /** Display title — may include event name or dominant signal verb. */
  title:         string
  /** 1-sentence description of what this cluster represents. */
  description:   string
  /** Every contact assigned to this surface. */
  people:        ContactInSurface[]
  /** Aggregated signal counts, sorted by count desc. */
  signals:       SurfaceSignalSummary[]
  /** Event names detected in tweet samples across all contacts in this surface. */
  eventMentions: string[]
  /** Top topic tokens present across this cluster (up to 6). */
  topics:        string[]
  /** Normalised strength 0–100. Higher = larger, more signal-rich cluster. */
  strength:      number
  /**
   * Three-part "why this matters" narrative — each sentence covers a distinct angle:
   *   signal       → what activity is happening in the cluster
   *   relationship → how the user is already positioned (warm / email / cold)
   *   action       → what to do given the cluster's bucket
   */
  whyItMattersParts: {
    signal:       string
    relationship: string
    action:       string
  }
  /** Pre-joined fallback for contexts that consume a single string. */
  whyItMatters:  string
  /**
   * Opportunities linked to this surface by domain.
   * Populated by the page after both opportunity pipelines have run.
   * Always an array (empty when no opportunities match).
   */
  relatedOpportunities: SurfaceOpportunity[]
  /**
   * Events that share people with this surface.
   * Populated by linkEventsToSurfaces() in the page after both
   * buildSurfaces() and buildEventRadar() have run.
   * Always an array (empty until linked).
   */
  relatedEvents: EventRef[]
  /** Quick relationship breakdown — used for the card sub-header. */
  relationshipSummary: {
    warmCount:  number
    emailCount: number
    coldCount:  number
  }
}

// ---------------------------------------------------------------------------
// Topic bucket definitions
// ---------------------------------------------------------------------------

/**
 * Maps a cluster label → set of topic tokens that qualify a contact for it.
 * Tokens should match what the X enrichment topic extraction produces:
 * lowercase, no leading #, no spaces (e.g. "buildinpublic" not "build in public").
 */
const TOPIC_BUCKETS: Record<string, string[]> = {
  "AI & ML": [
    "ai", "llm", "llms", "ml", "gpt", "gpt4", "openai", "anthropic", "genai",
    "aitools", "artificialintelligence", "machinelearning", "deeplearning",
    "rag", "agents", "aiagents", "foundation models", "mistral", "gemini",
  ],
  "SaaS & Product": [
    "saas", "b2b", "software", "platform", "product", "productmanagement",
    "productled", "plg", "prd", "productthinking", "productstrategy",
    "b2bsaas", "enterprisetech",
  ],
  "Startup": [
    "startup", "startups", "founder", "founders", "cofounder", "buildinpublic",
    "indiehacker", "indiehackers", "venture", "venturecapital", "bootstrap",
    "bootstrapped", "solofounder", "earlystagestartup", "seed",
  ],
  "Design & UX": [
    "design", "ux", "ui", "figma", "uxdesign", "productdesign", "typography",
    "branding", "uidesign", "webdesign", "designsystems", "designthinking",
    "userresearch",
  ],
  "Marketing & Growth": [
    "marketing", "growth", "growthhacking", "seo", "contentmarketing", "gtm",
    "demandgeneration", "brand", "copywriting", "b2bmarketing",
    "performancemarketing", "emailmarketing",
  ],
  "Web3 & Crypto": [
    "crypto", "web3", "nft", "blockchain", "defi", "ethereum", "bitcoin",
    "solana", "dao", "nfts", "cryptocurrency", "cryptotwitter",
  ],
  "DevTools & Eng": [
    "devtools", "developer", "engineering", "typescript", "javascript",
    "react", "nextjs", "api", "opensource", "devex", "platformengineering",
    "infratech", "developerexperience",
  ],
  "Revenue & Sales": [
    "sales", "revenue", "b2bsales", "outbound", "crm", "salesops",
    "accountexecutive", "sdr", "sdrs", "closingdeals", "salestips", "gtm",
  ],
}

// ---------------------------------------------------------------------------
// Event detection — scans raw tweet text for known conference / launch names
// ---------------------------------------------------------------------------

const EVENT_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\bSXSW\b/i,                                   name: "SXSW"          },
  { pattern: /\bFigma\s+Config\b|\bConfig\s+\d{4}\b/i,      name: "Config"        },
  { pattern: /\bProduct\s*Hunt\b/i,                          name: "Product Hunt"  },
  { pattern: /\bTechCrunch\s+Disrupt\b|\bTC\s+Disrupt\b/i,  name: "TC Disrupt"    },
  { pattern: /\bY\s+Combinator\b|\bYC\s+[SW]\d{2}\b/i,      name: "Y Combinator"  },
  { pattern: /\bDreamforce\b/i,                              name: "Dreamforce"    },
  { pattern: /\bWeb\s+Summit\b/i,                            name: "Web Summit"    },
  { pattern: /\bWWDC\b/i,                                    name: "Apple WWDC"    },
  { pattern: /\bGoogle\s+I\/O\b/i,                           name: "Google I/O"    },
  { pattern: /\bAWS\s+re:?Invent\b/i,                        name: "AWS re:Invent" },
  { pattern: /\bNeurIPS\b/i,                                 name: "NeurIPS"       },
  { pattern: /\bSeed\s+Summit\b/i,                           name: "Seed Summit"   },
  { pattern: /\bAngelConf\b|\bAngel\s+Conf\b/i,              name: "AngelConf"     },
  { pattern: /\bMakers\s+Festival\b/i,                       name: "Makers Festival"},
]

function detectEvents(tweetSamples: string[]): string[] {
  const found = new Set<string>()
  for (const tweet of tweetSamples) {
    for (const { pattern, name } of EVENT_PATTERNS) {
      if (pattern.test(tweet)) found.add(name)
    }
  }
  return [...found]
}

// ---------------------------------------------------------------------------
// Signal labels
// ---------------------------------------------------------------------------

const SIGNAL_LABELS: Record<string, string> = {
  launching:      "Launching",
  hiring:         "Hiring",
  building:       "Building",
  fundraising:    "Fundraising",
  announcing:     "Announcing",
  growth:         "Growing",
  recommendation: "Looking for help",
  pain:           "Expressed need",
}

// ---------------------------------------------------------------------------
// Title generation
// ---------------------------------------------------------------------------

const SIGNAL_VERBS: Record<string, string> = {
  fundraising:    "Fundraising",
  launching:      "Launching",
  recommendation: "Looking for Help",
  pain:           "Facing Challenges",
  hiring:         "Hiring",
  announcing:     "Announcing",
  growth:         "Growing Fast",
  building:       "Building",
}

function buildTitle(
  bucket:        string,
  dominantSignal: string | null,
  eventMentions: string[],
): string {
  // Event-led title takes clear precedence — most specific signal
  if (eventMentions.length > 0) {
    return `${eventMentions[0]} — ${bucket}`
  }
  if (dominantSignal && SIGNAL_VERBS[dominantSignal]) {
    return `${bucket} — ${SIGNAL_VERBS[dominantSignal]}`
  }
  return bucket
}

// ---------------------------------------------------------------------------
// Narrative generation
// ---------------------------------------------------------------------------

const BUCKET_DESCRIPTIONS: Record<string, string> = {
  "AI & ML":           "Builders, researchers, and founders active in the AI space",
  "SaaS & Product":    "SaaS companies and product-led teams showing strong activity",
  "Startup":           "Early-stage founders building in public and raising capital",
  "Design & UX":       "Designers and product creatives in your extended network",
  "Marketing & Growth":"Marketers and growth practitioners signalling active work",
  "Web3 & Crypto":     "Web3 founders and operators showing recent activity",
  "DevTools & Eng":    "Engineers and developer-tool builders in your network",
  "Revenue & Sales":   "Revenue leaders and sales operators actively building pipelines",
}

const BUCKET_ACTION: Record<string, string> = {
  "AI & ML":           "AI moves fast — this is a good window to show up before the moment passes.",
  "SaaS & Product":    "SaaS teams at this stage frequently need external support for positioning and creative work.",
  "Startup":           "Early founders are receptive to agencies that understand their stage and pace.",
  "Design & UX":       "Designers are strong referral sources — staying visible here pays off over time.",
  "Marketing & Growth":"Marketers with active signal often have adjacent budget and clear priorities.",
  "Web3 & Crypto":     "Web3 activity is cyclical — connect while momentum is high.",
  "DevTools & Eng":    "Engineering-led companies often under-invest in positioning and go-to-market — that's a gap you can fill.",
  "Revenue & Sales":   "Revenue leaders actively building pipelines often need creative and brand firepower.",
}

/**
 * Builds a three-part "why this matters" narrative:
 *  1. signal       — what activity is actually happening
 *  2. relationship — how the user is already positioned (warm / email / cold)
 *  3. action       — what to do, tailored to the bucket
 */
function buildWhyItMattersParts(
  people:        ContactInSurface[],
  signals:       SurfaceSignalSummary[],
  eventMentions: string[],
  bucket:        string,
): { signal: string; relationship: string; action: string } {

  // ── Warmth tiers ────────────────────────────────────────────────────────────
  const warmPeople  = people.filter((p) => p.meetingCount > 0 || p.interactionScore >= 8)
  const emailPeople = people.filter(
    (p) => p.meetingCount === 0 && p.interactionScore >= 3 && p.interactionScore < 8,
  )

  // ── Signal counts ────────────────────────────────────────────────────────────
  const sm            = new Map(signals.map((s) => [s.type, s.count]))
  const launchCount   = sm.get("launching")      ?? 0
  const fundraCount   = sm.get("fundraising")    ?? 0
  const hiringCount   = sm.get("hiring")         ?? 0
  const buildCount    = sm.get("building")       ?? 0
  const buyingCount   = (sm.get("recommendation") ?? 0) + (sm.get("pain") ?? 0)

  // ── Part 1: what's happening ─────────────────────────────────────────────────
  let signal: string

  if (buyingCount >= 2) {
    signal = `${buyingCount} contacts here have publicly asked for agency or service recommendations — expressed need, not just ambient activity.`
  } else if (buyingCount === 1) {
    signal = `One contact has posted looking for agency or service support — a direct signal of expressed need that's easy to act on.`
  } else if (launchCount >= 2 && fundraCount >= 1) {
    signal = `${launchCount} contacts are launching and ${fundraCount} are fundraising — two of the highest-receptivity moments for new partnerships, happening simultaneously.`
  } else if (launchCount >= 2) {
    signal = `${launchCount} of these contacts are actively launching — exactly the inflection point when teams reach for outside support.`
  } else if (launchCount === 1 && fundraCount >= 1) {
    signal = `Someone here is launching and another is raising — both are moments when teams are open to new relationships and spend.`
  } else if (fundraCount >= 2) {
    signal = `${fundraCount} contacts are showing fundraising signals — post-raise is when spend decisions accelerate and new vendors get evaluated.`
  } else if (eventMentions.length > 0 && people.length >= 3) {
    signal = `This cluster is converging around ${eventMentions[0]} — a shared context that makes showing up in that space unusually high-leverage.`
  } else if (hiringCount >= 2) {
    signal = `${hiringCount} companies here are actively hiring — typically a growth phase with more budget and more decisions in motion.`
  } else if (buildCount >= 3) {
    signal = `${buildCount} contacts are building in public — strong momentum signal and high receptivity to tools and partnerships.`
  } else if (people.length >= 5) {
    signal = `This is one of the denser pockets in your network — ${people.length} people with overlapping interests and consistent signal.`
  } else {
    const top = signals[0]
    signal = top
      ? `Multiple contacts here are ${top.label.toLowerCase()}, with consistent activity across shared topics.`
      : `${people.length} people in your network are active here with shared signal and topic overlap.`
  }

  // ── Part 2: relationship angle ───────────────────────────────────────────────
  let relationship: string

  const firstName = (p: ContactInSurface) =>
    p.name?.split(" ")[0] ?? p.email.split("@")[0]

  if (warmPeople.length >= 3) {
    relationship = `You've already met ${warmPeople.length} of them — warm outreach across this whole cluster is natural and expected.`
  } else if (warmPeople.length === 2) {
    const names = warmPeople.map(firstName).join(" and ")
    relationship = `You've met ${names} personally — a strong foundation for introductions to the rest of the cluster.`
  } else if (warmPeople.length === 1 && emailPeople.length >= 2) {
    relationship = `You know ${firstName(warmPeople[0])} personally and have email history with ${emailPeople.length} others — well-positioned to move fast here.`
  } else if (warmPeople.length === 1) {
    relationship = `You know ${firstName(warmPeople[0])} personally — a direct entry point that makes reaching the wider cluster far more natural.`
  } else if (emailPeople.length >= 3) {
    relationship = `You have email history with ${emailPeople.length} of them — enough existing context to make outreach feel warm, not cold.`
  } else if (emailPeople.length === 2) {
    const names = emailPeople.map(firstName).join(" and ")
    relationship = `You've exchanged emails with ${names} — solid footholds for warm introductions into the cluster.`
  } else if (emailPeople.length === 1) {
    relationship = `You've exchanged emails with ${firstName(emailPeople[0])} — a foot in the door for the wider cluster.`
  } else if (people.length >= 5) {
    relationship = `These are mostly second-degree connections, but the shared context means a well-timed message will land far better than a cold approach.`
  } else {
    relationship = `You don't have existing relationships here yet — but the signal activity makes this a well-timed moment to engage.`
  }

  // ── Part 3: action prompt ────────────────────────────────────────────────────
  const action = BUCKET_ACTION[bucket] ?? "Worth showing up here while the signal is strong."

  return { signal, relationship, action }
}

// ---------------------------------------------------------------------------
// Core export
// ---------------------------------------------------------------------------

/** Minimum contacts required to form a Surface. Fewer than 2 is noise. */
const MIN_CLUSTER_SIZE = 2

/** Maximum surfaces returned — keeps the list curated and actionable. */
const MAX_SURFACES = 8

/**
 * Derives a list of Surfaces from a set of contacts.
 * Pure function — no side effects, no DB access.
 *
 * @param contacts - Full contact list (un-enriched contacts are automatically skipped)
 */
export function buildSurfaces(contacts: Contact[]): Surface[] {
  // Step 1: only work with enriched contacts (they have topic + signal data)
  const enriched = contacts.filter((c) => c.twitterData != null)
  if (enriched.length < MIN_CLUSTER_SIZE) return []

  // Step 2: assign each contact to at most 2 matching buckets
  const bucketContacts = new Map<string, Contact[]>()

  for (const contact of enriched) {
    const topics  = (contact.twitterData?.topics ?? []).map((t) => t.toLowerCase().trim())
    const matched = new Set<string>()

    for (const [bucketName, keywords] of Object.entries(TOPIC_BUCKETS)) {
      if (topics.some((t) => keywords.includes(t))) {
        matched.add(bucketName)
      }
    }

    // Cap at 2 buckets per contact to keep clusters tight
    for (const b of [...matched].slice(0, 2)) {
      if (!bucketContacts.has(b)) bucketContacts.set(b, [])
      bucketContacts.get(b)!.push(contact)
    }
  }

  // Step 3: build Surface objects for qualifying clusters
  const surfaces: Surface[] = []

  for (const [bucket, members] of bucketContacts) {
    if (members.length < MIN_CLUSTER_SIZE) continue

    const signalCounts = new Map<string, number>()
    const allTopics    = new Set<string>()
    const allEvents    = new Set<string>()

    const people: ContactInSurface[] = members.map((c) => {
      const td = c.twitterData!

      // Accumulate signals
      for (const s of td.signals ?? []) {
        signalCounts.set(s, (signalCounts.get(s) ?? 0) + 1)
      }

      // Accumulate topics
      for (const t of td.topics ?? []) allTopics.add(t.toLowerCase().trim())

      // Detect events from tweet samples
      for (const ev of detectEvents(td.tweetSamples ?? [])) allEvents.add(ev)

      return {
        email:            c.email,
        name:             c.name,
        companyName:      c.companyName,
        domain:           c.domain,
        twitterHandle:    td.handle,
        signals:          td.signals ?? [],
        topics:           td.topics ?? [],
        bio:              td.bio,
        interactionScore: c.interactionScore,
        meetingCount:     c.meetingCount,
      }
    })

    // Build sorted signal summaries
    const signals: SurfaceSignalSummary[] = [...signalCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({
        type,
        label: SIGNAL_LABELS[type] ?? type,
        count,
      }))

    const eventMentions    = [...allEvents]
    const dominantSignal   = signals[0]?.type ?? null

    // Topic tokens that aren't just the bucket's own keywords (keep it fresh)
    const bucketKeywords   = new Set(TOPIC_BUCKETS[bucket] ?? [])
    const topics           = [...allTopics]
      .filter((t) => !bucketKeywords.has(t))
      .slice(0, 6)

    // Step 4: strength score — log(size) × (1 + signal_variety) × event_boost
    const signalVariety = signalCounts.size
    const eventBoost    = eventMentions.length > 0 ? 1.4 : 1.0
    const rawStrength   = Math.log(members.length + 1) * (1 + signalVariety) * eventBoost
    // Normalise to 0–100 (ceiling at ~15 raw feels right for typical cluster sizes)
    const strength      = Math.min(100, Math.round((rawStrength / 15) * 100))

    const whyItMattersParts = buildWhyItMattersParts(people, signals, eventMentions, bucket)

    // Relationship summary — quick counts for the card header
    const relationshipSummary = {
      warmCount:  people.filter((p) => p.meetingCount > 0 || p.interactionScore >= 8).length,
      emailCount: people.filter((p) => p.meetingCount === 0 && p.interactionScore >= 3 && p.interactionScore < 8).length,
      coldCount:  people.filter((p) => p.interactionScore < 3 && p.meetingCount === 0).length,
    }

    surfaces.push({
      id:           bucket.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      title:        buildTitle(bucket, dominantSignal, eventMentions),
      description:  BUCKET_DESCRIPTIONS[bucket] ?? `A cluster of contacts active in ${bucket}.`,
      people,
      signals,
      eventMentions,
      topics,
      strength,
      whyItMattersParts,
      relatedOpportunities: [],   // filled in by the page after pipeline runs
      relatedEvents:         [],   // filled in by linkEventsToSurfaces() in the page
      whyItMatters: [
        whyItMattersParts.signal,
        whyItMattersParts.relationship,
        whyItMattersParts.action,
      ].join(" "),
      relationshipSummary,
    })
  }

  // Step 5: sort by strength desc, cap at MAX_SURFACES
  return surfaces
    .sort((a, b) => b.strength - a.strength)
    .slice(0, MAX_SURFACES)
}
