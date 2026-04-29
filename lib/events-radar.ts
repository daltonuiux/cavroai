/**
 * Events Radar — surfaces relevant events based on network activity.
 *
 * Answers: "Where should I show up?"
 *
 * Algorithm
 * ─────────
 * 1. Scan each enriched contact's tweetSamples for event mentions:
 *    a. Known events — match against a curated alias table (high precision)
 *    b. Unknown events — extract capitalised phrases after attendance verbs
 * 2. Normalise candidate names (strip years, lowercase for dedup key)
 * 3. Group mentions by normalised key
 * 4. Validate:
 *    - Known events:   ≥2 distinct contacts OR ≥1 warm/email contact
 *    - Unknown events: ≥2 distinct contacts (noise filter)
 *    - All events:     score ≥ MIN_SCORE after computation
 * 5. For each event, collect attendees, aggregate signals, detect date/location
 * 6. Compute confidence (high | medium) and collect source evidence snippets
 * 7. Score and sort — cap at MAX_EVENTS
 *
 * No DB writes. Pure computation over Contact[].
 */

import type { Contact, TwitterSignal } from "./contact-graph"
import { signalLabel } from "./contact-graph"

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface EventAttendee {
  email:            string
  name:             string | null
  companyName:      string
  domain:           string
  twitterHandle:    string
  signals:          TwitterSignal[]
  interactionScore: number
  meetingCount:     number
  /** Verbatim tweet snippet that triggered the detection. */
  mentionContext:   string
  /** Inferred role from the phrasing ("speaking at" vs "going to"). */
  role:             "speaker" | "attendee" | "unknown"
}

export interface EventSignalSummary {
  type:  string
  label: string
  count: number
}

/**
 * A compact reference to a surface (community cluster) that shares people
 * with this event. Populated by linkEventsToSurfaces() in the page.
 */
export interface SurfaceRef {
  id:               string
  title:            string
  strength:         number
  /** How many people appear in both this event and this surface. */
  sharedPeopleCount: number
}

export interface RadarEvent {
  /** Stable ID — normalised name without spaces or punctuation. */
  id:             string
  /** Display name — canonical or title-cased extracted phrase. */
  name:           string
  /** Total tweet mentions (one contact may mention it multiple times). */
  mentionCount:   number
  /** Number of unique contacts in your network attending. */
  attendeeCount:  number
  /** Attendees sorted warm-first. */
  people:         EventAttendee[]
  /** Aggregated signals from all attendees, sorted by count desc. */
  signals:        EventSignalSummary[]
  /** Parsed date hint from tweet text, or null. */
  estimatedDate:  string | null
  /** Parsed location hint from tweet text, or null. */
  location:       string | null
  /** Normalised 0–100. */
  score:          number
  /** 2–3 sentence "why attend" narrative. */
  whyAttend:      string
  /** True when the event was in the curated known-events list. */
  isKnown:        boolean
  /**
   * Confidence tier:
   * - "high":   known event with ≥1 warm contact, or ≥2 contacts of any warmth
   * - "medium": known event, 1 contact, or unknown event with all-cold contacts
   * Low-confidence events are dropped before they reach this type.
   */
  confidence:     "high" | "medium"
  /**
   * Short "what is this event" description (curated for known events, null for
   * unknown events extracted from tweet text).
   */
  description:    string | null
  /**
   * Top 1–2 verbatim tweet snippets that triggered this event's detection,
   * ordered: speaker > warm > email > cold. Used for card-level evidence display.
   */
  sourceEvidence: string[]
  /**
   * Surface clusters that share people with this event.
   * Populated by linkEventsToSurfaces() in the page, not by buildEventRadar().
   * Always an array (empty until linked).
   */
  relatedSurfaces: SurfaceRef[]
}

// ---------------------------------------------------------------------------
// Curated known-events table
// ---------------------------------------------------------------------------

interface KnownEvent {
  canonical:    string
  /** Short "what is this" blurb shown in the card. */
  description:  string
  /** All strings that should map to this event (lowercase). */
  aliases:      string[]
}

const KNOWN_EVENTS: KnownEvent[] = [
  {
    canonical:   "SXSW",
    description: "Annual arts, music, and tech festival in Austin — where startups launch and deals get made.",
    aliases:     ["sxsw", "south by southwest", "south by", "southbysouthwest"],
  },
  {
    canonical:   "Config",
    description: "Figma's annual design conference — the gathering point for product designers, PMs, and design-led founders.",
    aliases:     ["figma config", "config", "config sf", "config 2025", "config 2026"],
  },
  {
    canonical:   "Product Hunt",
    description: "Online platform where new products launch and get voted on — a high-visibility moment for startups.",
    aliases:     ["product hunt", "producthunt"],
  },
  {
    canonical:   "TC Disrupt",
    description: "TechCrunch's flagship startup competition — investors, press, and founders in one room.",
    aliases:     ["techcrunch disrupt", "tc disrupt", "disrupt sf", "techcrunch"],
  },
  {
    canonical:   "Y Combinator",
    description: "YC's demo day — a batch of funded startups pitching to investors, alumni, and press.",
    aliases:     ["y combinator", "ycombinator", "yc demo day", "yc demoday", "demo day"],
  },
  {
    canonical:   "Web Summit",
    description: "One of Europe's largest tech conferences in Lisbon — 70K+ attendees, global startup ecosystem.",
    aliases:     ["web summit", "websummit"],
  },
  {
    canonical:   "Apple WWDC",
    description: "Apple's annual developer conference — platform announcements, SDK changes, and design system updates.",
    aliases:     ["wwdc", "apple wwdc"],
  },
  {
    canonical:   "Google I/O",
    description: "Google's annual developer conference — AI, Android, and platform updates.",
    aliases:     ["google i/o", "google io"],
  },
  {
    canonical:   "AWS re:Invent",
    description: "Amazon's annual cloud conference in Las Vegas — enterprise infra, tooling, and partner ecosystem.",
    aliases:     ["aws reinvent", "aws re:invent", "reinvent"],
  },
  {
    canonical:   "NeurIPS",
    description: "Leading AI/ML research conference — cutting-edge papers and the researchers who write them.",
    aliases:     ["neurips", "nips conference"],
  },
  {
    canonical:   "Dreamforce",
    description: "Salesforce's annual conference in San Francisco — enterprise sales, CRM, and partner network.",
    aliases:     ["dreamforce"],
  },
  {
    canonical:   "SaaStr Annual",
    description: "The world's largest SaaS community event — revenue operators, founders, and investors.",
    aliases:     ["saastr", "saastr annual"],
  },
  {
    canonical:   "Collision",
    description: "Fast-growing North American tech conference — a mix of investors, founders, and enterprise buyers.",
    aliases:     ["collision conf", "collision conference", "collision"],
  },
  {
    canonical:   "Slush",
    description: "Nordic startup conference in Helsinki — strong European VC and deep-tech ecosystem.",
    aliases:     ["slush", "slush helsinki"],
  },
  {
    canonical:   "VivaTech",
    description: "Europe's biggest startup and tech event in Paris — 150K+ visitors, corporate innovation focus.",
    aliases:     ["vivatech", "viva technology"],
  },
  {
    canonical:   "CES",
    description: "World's largest consumer electronics show in Las Vegas — product launches at global scale.",
    aliases:     ["ces", "consumer electronics show"],
  },
  {
    canonical:   "Cannes Lions",
    description: "International advertising and creativity festival — agencies, brands, and media companies.",
    aliases:     ["cannes lions", "cannes"],
  },
  {
    canonical:   "AngelConf",
    description: "Early-stage investor conference — angels, pre-seed founders, and scouts.",
    aliases:     ["angelconf", "angel conf"],
  },
  {
    canonical:   "Signal",
    description: "Annual messaging and product conference — developer and product-focused talks.",
    aliases:     ["signal conference", "signal conf"],
  },
  {
    canonical:   "Seed Summit",
    description: "Early-stage fundraising event in London — pre-seed and seed founders meeting investors.",
    aliases:     ["seed summit"],
  },
  {
    canonical:   "TNW",
    description: "The Next Web conference in Amsterdam — European tech and startup ecosystem.",
    aliases:     ["tnw", "the next web"],
  },
  {
    canonical:   "Figma Config",
    description: "Figma's flagship design conference — design tools, systems, and the future of product design.",
    aliases:     ["figma config 2025", "figma config 2026"],
  },
  {
    canonical:   "Intersect",
    description: "Design and tech conference — where product, engineering, and design communities meet.",
    aliases:     ["intersect festival", "intersect conf"],
  },
]

/** Fast lookup: canonical name → description for known events. */
const DESCRIPTION_BY_CANONICAL = new Map<string, string>(
  KNOWN_EVENTS.map(({ canonical, description }) => [canonical, description]),
)

// ---------------------------------------------------------------------------
// Attendance patterns — extract unknown events from tweet text
// ---------------------------------------------------------------------------

/**
 * Each regex has exactly one capture group containing the event-name candidate.
 * Pattern: attendance verb → capitalised phrase (1–3 words).
 *
 * [A-Z][A-Za-z0-9']+ — starts uppercase, min 2 chars total (avoids pronoun "I")
 */
const ATTENDANCE_REGEXES: RegExp[] = [
  // Physical presence
  /\b(?:going\s+to|heading\s+to|see\s+you\s+at|will\s+be\s+at|be\s+at|attending)\s+([A-Z][A-Za-z0-9']+(?:\s+[A-Z][A-Za-z0-9']+){0,2})/g,
  // Speaking
  /\b(?:speaking\s+at|presenting\s+at|keynoting\s+at|on\s+a\s+panel\s+at|paneling\s+at)\s+([A-Z][A-Za-z0-9']+(?:\s+[A-Z][A-Za-z0-9']+){0,2})/g,
  // Excitement / registration
  /\b(?:excited\s+(?:for|about)|can'?t\s+wait\s+for|looking\s+forward\s+to|registered\s+for|joining\s+(?:us\s+at)?)\s+([A-Z][A-Za-z0-9']+(?:\s+[A-Z][A-Za-z0-9']+){0,2})/g,
]

/** Determines if a tweet suggests the contact is speaking (vs simply attending). */
const SPEAKER_RE = /\b(?:speaking\s+at|presenting\s+at|keynot(?:e|ing)\s+at|on\s+a\s+panel|paneling\s+at)\b/i

/** Determines if a tweet suggests general attendance. */
const ATTENDEE_RE = /\b(?:going\s+to|heading\s+to|attending|will\s+be\s+at|see\s+you\s+at)\b/i

function classifyRole(tweet: string): "speaker" | "attendee" | "unknown" {
  if (SPEAKER_RE.test(tweet))  return "speaker"
  if (ATTENDEE_RE.test(tweet)) return "attendee"
  return "unknown"
}

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

/** Strip year suffixes so "Config 2026" and "Config 2025" dedup to "config". */
function stripYear(name: string): string {
  return name
    .replace(/\b20\d{2}\b/g, "")
    .replace(/'\d{2}\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Stable dedup key — lowercase, alphanum + spaces only. */
function normalizeKey(name: string): string {
  return stripYear(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Title-case an extracted phrase. */
function titleCase(s: string): string {
  return s
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

// ---------------------------------------------------------------------------
// Date and location extraction
// ---------------------------------------------------------------------------

const MONTH_RE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:\s*[-–]\s*\d{1,2})?\b/i

const RELATIVE_DATE_RE = /\b(this\s+(?:week|weekend|month)|next\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i

const CITY_MAP: Record<string, string> = {
  "san francisco": "San Francisco", "sf":             "San Francisco",
  "new york":      "New York",      "nyc":            "New York",
  "los angeles":   "Los Angeles",   "la":             "Los Angeles",
  "austin":        "Austin",        "london":         "London",
  "berlin":        "Berlin",        "amsterdam":      "Amsterdam",
  "paris":         "Paris",         "tokyo":          "Tokyo",
  "singapore":     "Singapore",     "sydney":         "Sydney",
  "toronto":       "Toronto",       "seattle":        "Seattle",
  "chicago":       "Chicago",       "miami":          "Miami",
  "boston":        "Boston",        "denver":         "Denver",
  "las vegas":     "Las Vegas",     "barcelona":      "Barcelona",
  "lisbon":        "Lisbon",        "helsinki":       "Helsinki",
}

/** Extracts a human-readable date hint from tweet text, or null. */
function extractDate(text: string): string | null {
  const rel = RELATIVE_DATE_RE.exec(text)
  if (rel) return titleCase(rel[1])

  const abs = MONTH_RE.exec(text)
  if (abs) return `${titleCase(abs[1])} ${abs[2]}`

  return null
}

/** Extracts a city name from tweet text, or null. */
function extractLocation(text: string): string | null {
  const lower = text.toLowerCase()

  // "in City" or "in City, ST"
  const inMatch = lower.match(/\bin\s+([a-z\s]{3,20})(?:[,.]|$)/i)
  if (inMatch) {
    const candidate = inMatch[1].trim()
    if (CITY_MAP[candidate]) return CITY_MAP[candidate]
  }

  // Direct city name presence
  for (const [key, display] of Object.entries(CITY_MAP)) {
    if (lower.includes(key)) return display
  }

  return null
}

// ---------------------------------------------------------------------------
// Signal scoring tables
// ---------------------------------------------------------------------------

const SIGNAL_STRENGTH: Partial<Record<TwitterSignal, number>> = {
  recommendation: 4,
  pain:           3.5,
  fundraising:    3.5,
  launching:      3,
  hiring:         2.5,
  growth:         2,
  announcing:     1.5,
  building:       1,
}

const SIGNAL_LABELS: Record<string, string> = {
  launching:      "Launching",
  hiring:         "Hiring",
  building:       "Building",
  fundraising:    "Fundraising",
  announcing:     "Announcing",
  growth:         "Growing",
  partnership:    "New partnership",
  expansion:      "Expanding",
  recommendation: "Looking for help",
  pain:           "Expressed need",
}

// ---------------------------------------------------------------------------
// Warmth helper (shared between scoring and UI logic)
// ---------------------------------------------------------------------------

export function attendeeWarmth(a: Pick<EventAttendee, "meetingCount" | "interactionScore">): "warm" | "email" | "cold" {
  if (a.meetingCount > 0 || a.interactionScore >= 8) return "warm"
  if (a.interactionScore >= 3)                       return "email"
  return "cold"
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function computeScore(attendees: EventAttendee[], signals: EventSignalSummary[]): number {
  // Base — each unique attendee is worth 10 points
  const base = attendees.length * 10

  // Signal bonus — strength-weighted sum across all attendees
  const signalBonus = signals.reduce((sum, s) => {
    const strength = SIGNAL_STRENGTH[s.type as TwitterSignal] ?? 1
    return sum + strength * s.count
  }, 0)

  // Warmth bonus — warm contacts are worth more than cold ones
  const warmthBonus = attendees.reduce((sum, a) => {
    const w = attendeeWarmth(a)
    return sum + (w === "warm" ? 8 : w === "email" ? 4 : 1)
  }, 0)

  // Speaker boost — speakers usually attract the right crowd
  const speakerBoost = attendees.some((a) => a.role === "speaker") ? 8 : 0

  const raw = base + signalBonus + warmthBonus + speakerBoost
  // Normalise: ~5 warm contacts with mixed signals ≈ raw 120 → score ~80
  return Math.min(100, Math.round(raw * 0.65))
}

// ---------------------------------------------------------------------------
// Narrative generation
// ---------------------------------------------------------------------------

/**
 * Produces a single, punchy "Why attend" line in the form:
 *   [observation] — [implication]
 *
 * Priority waterfall — first matching condition wins.
 * Each branch returns immediately so the function always yields one sentence.
 */
function buildWhyAttend(
  attendees:  EventAttendee[],
  signals:    EventSignalSummary[],
  _eventName: string,
): string {
  const warmPeople  = attendees.filter((a) => attendeeWarmth(a) === "warm")
  const emailPeople = attendees.filter((a) => attendeeWarmth(a) === "email")
  const speakers    = attendees.filter((a) => a.role === "speaker")

  const sm          = new Map(signals.map((s) => [s.type, s.count]))
  const launchCount = sm.get("launching")      ?? 0
  const fundraCount = sm.get("fundraising")    ?? 0
  const buyingCount = (sm.get("recommendation") ?? 0) + (sm.get("pain") ?? 0)
  const hiringCount = sm.get("hiring")         ?? 0

  const firstName = (a: EventAttendee) =>
    a.name?.split(" ")[0] ?? a.email.split("@")[0]

  // 1. Speaker you already know (most specific possible signal)
  const knownSpeaker = speakers.find(
    (s) => warmPeople.includes(s) || emailPeople.includes(s),
  )
  if (knownSpeaker) {
    return `${firstName(knownSpeaker)} is speaking and you already know them — low-friction entry into the room.`
  }

  // 2. Multiple speakers from your network
  if (speakers.length >= 2) {
    const names = speakers.slice(0, 2).map(firstName).join(" and ")
    return `${names} are speaking — your network has direct access into the room.`
  }
  if (speakers.length === 1) {
    return `${firstName(speakers[0])} is speaking — a natural anchor and easy conversation starter.`
  }

  // 3. Known relationship + strong signal (highest ROI combination)
  if (warmPeople.length >= 1 && launchCount >= 2) {
    return `You know ${warmPeople.length === 1 ? firstName(warmPeople[0]) : `${warmPeople.length} attendees`} and multiple companies are launching here — warm conversations in a high-signal environment.`
  }
  if (warmPeople.length >= 1 && fundraCount >= 2) {
    return `You know ${warmPeople.length === 1 ? firstName(warmPeople[0]) : `${warmPeople.length} attendees`} and several are fundraising — well-timed for a natural reconnect.`
  }

  // 4. Direct buying / agency signal
  if (buyingCount >= 2) {
    return `${buyingCount} attendees have posted looking for agency support — expressed need, not ambient activity.`
  }
  if (buyingCount === 1) {
    return `One attendee has posted looking for agency support — a direct signal worth acting on.`
  }

  // 5. Launch signal (high receptivity moment)
  if (launchCount >= 3) {
    return `${launchCount} companies in your network are launching here — high-signal environment for new partnerships.`
  }
  if (launchCount >= 2) {
    return `Several companies are launching here — high-signal environment for new partnerships.`
  }

  // 6. Fundraising signal
  if (fundraCount >= 2) {
    return `${fundraCount} contacts are fundraising — post-raise spend decisions tend to accelerate fast.`
  }

  // 7. Strong existing relationships (warm)
  if (warmPeople.length >= 3) {
    return `You've already met ${warmPeople.length} attendees — easy entry point for warm reconnects.`
  }
  if (warmPeople.length === 2) {
    return `You already know ${warmPeople.map(firstName).join(" and ")} — a natural foundation for working the room.`
  }
  if (warmPeople.length === 1) {
    return `You know ${firstName(warmPeople[0])} personally — an easy anchor for the event.`
  }

  // 8. Email relationships
  if (emailPeople.length >= 2) {
    return `You have email history with ${emailPeople.length} attendees — warm enough to pick up in person.`
  }
  if (emailPeople.length === 1) {
    return `You've emailed ${firstName(emailPeople[0])} before — a low-friction starting point.`
  }

  // 9. Hiring signal
  if (hiringCount >= 2) {
    return `${hiringCount} companies here are actively hiring — growth phase, more budget, more decisions.`
  }

  // 10. High attendance density
  if (attendees.length >= 4) {
    return `${attendees.length} people from your network are going — strong concentration relative to your radar.`
  }

  // Fallback
  const n = attendees.length
  return `${n} ${n === 1 ? "contact" : "contacts"} from your network ${n === 1 ? "is" : "are"} attending — worth showing up.`
}

// ---------------------------------------------------------------------------
// Source evidence collection
// ---------------------------------------------------------------------------

/**
 * Selects up to 2 representative tweet snippets for card-level evidence display.
 *
 * Priority buckets (first match wins per slot):
 *   0. Tweets with a date AND location (most concrete — acts as proof)
 *   1. Tweets with date OR location (partial ground truth)
 *   2. Speakers (high-intent attendance signal)
 *   3. Warm contacts (existing relationship)
 *   4. Email contacts
 *   5. Cold contacts (weakest, but still a mention)
 *
 * Deduplicates by the first 60 characters to avoid near-duplicate quotes.
 * Shows up to 280 characters — full tweet length — so nothing is hidden.
 */
function collectSourceEvidence(
  mentions:       Array<{ tweet: string; contactEmail: string }>,
  attendees:      EventAttendee[],
  estimatedDate:  string | null,
  location:       string | null,
  maxSnippets = 2,
): string[] {
  const attendeeByEmail = new Map(attendees.map((a) => [a.email, a]))

  // Six priority buckets
  const buckets: Array<{ tweet: string; contactEmail: string }[]> = [
    [], // 0: has date + location
    [], // 1: has date OR location
    [], // 2: speaker
    [], // 3: warm
    [], // 4: email
    [], // 5: cold
  ]

  for (const m of mentions) {
    const a = attendeeByEmail.get(m.contactEmail)
    if (!a) continue

    const tweetLower     = m.tweet.toLowerCase()
    const hasTweetDate   = estimatedDate
      ? tweetLower.includes(estimatedDate.toLowerCase().slice(0, 3))  // e.g. "jan"
        || /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|next\s+week|this\s+week)\b/i.test(m.tweet)
      : false
    const hasTweetLoc    = location
      ? tweetLower.includes(location.toLowerCase())
      : false

    if (hasTweetDate && hasTweetLoc) buckets[0].push(m)
    else if (hasTweetDate || hasTweetLoc) buckets[1].push(m)
    else if (a.role === "speaker")        buckets[2].push(m)
    else if (attendeeWarmth(a) === "warm")  buckets[3].push(m)
    else if (attendeeWarmth(a) === "email") buckets[4].push(m)
    else                                   buckets[5].push(m)
  }

  const ordered = buckets.flat()
  const results: string[] = []
  const seen    = new Set<string>()

  for (const m of ordered) {
    if (results.length >= maxSnippets) break
    // Show up to 280 chars — full tweet length, never truncate mid-sentence
    const raw     = m.tweet.trim()
    const snippet = raw.length > 280 ? raw.slice(0, 277) + "…" : raw
    const key     = snippet.slice(0, 60).toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      results.push(snippet)
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Core export
// ---------------------------------------------------------------------------

/**
 * Minimum computed score an event must reach to be included.
 * Drops technically-valid but very weak events before the list is returned.
 */
const MIN_SCORE = 20

/** Cap on returned events — keeps the list curated and actionable. */
const MAX_EVENTS = 10

interface RawMention {
  normalizedKey: string
  canonicalName: string
  tweet:         string
  contactEmail:  string
  isKnown:       boolean
}

/**
 * Derives a radar of relevant events from a set of enriched contacts.
 * Pure function — no side effects, no DB access.
 *
 * @param contacts - Full contact list (un-enriched contacts are skipped)
 */
export function buildEventRadar(contacts: Contact[]): RadarEvent[] {
  const enriched = contacts.filter((c) => c.twitterData != null)
  if (enriched.length === 0) return []

  // ── Step 1: extract all raw mentions from tweetSamples ──────────────────────
  const allMentions: RawMention[] = []

  // Pre-build known-event lookup for fast matching
  const knownLookup: Array<{ key: string; canonical: string }> =
    KNOWN_EVENTS.flatMap(({ canonical, aliases }) =>
      [canonical.toLowerCase(), ...aliases].map((key) => ({ key, canonical })),
    )

  for (const contact of enriched) {
    const samples = contact.twitterData!.tweetSamples ?? []

    for (const tweet of samples) {
      const tweetLower = tweet.toLowerCase()
      const foundKeys  = new Set<string>() // dedup per tweet

      // a) Match known events
      for (const { key, canonical } of knownLookup) {
        if (tweetLower.includes(key)) {
          const normKey = normalizeKey(canonical)
          if (!foundKeys.has(normKey)) {
            foundKeys.add(normKey)
            allMentions.push({
              normalizedKey: normKey,
              canonicalName: canonical,
              tweet,
              contactEmail: contact.email,
              isKnown: true,
            })
          }
        }
      }

      // b) Extract unknown events via attendance patterns
      for (const re of ATTENDANCE_REGEXES) {
        re.lastIndex = 0 // reset global regex
        let match: RegExpExecArray | null
        while ((match = re.exec(tweet)) !== null) {
          const raw       = match[1]?.trim()
          if (!raw || raw.length < 3) continue
          const cleaned   = stripYear(raw)
          if (cleaned.length < 3) continue
          const normKey   = normalizeKey(cleaned)
          if (normKey.length < 3) continue

          // Skip if already captured as a known event this tweet
          if (foundKeys.has(normKey)) continue

          // Skip if it's a known event (already handled above)
          const isAlreadyKnown = knownLookup.some((k) =>
            normalizeKey(k.key) === normKey || normalizeKey(k.canonical) === normKey,
          )
          if (isAlreadyKnown) continue

          foundKeys.add(normKey)
          allMentions.push({
            normalizedKey: normKey,
            canonicalName: titleCase(cleaned),
            tweet,
            contactEmail: contact.email,
            isKnown: false,
          })
        }
      }
    }
  }

  // ── Step 2: group mentions by normalised key ─────────────────────────────────
  const grouped = new Map<
    string,
    { mentions: RawMention[]; canonical: string; isKnown: boolean }
  >()

  for (const m of allMentions) {
    if (!grouped.has(m.normalizedKey)) {
      grouped.set(m.normalizedKey, {
        mentions:  [],
        canonical: m.canonicalName,
        isKnown:   m.isKnown,
      })
    }
    const entry = grouped.get(m.normalizedKey)!
    entry.mentions.push(m)
    // Prefer the known-event canonical name if available
    if (m.isKnown) {
      entry.canonical = m.canonicalName
      entry.isKnown   = true
    }
  }

  // ── Step 3: build RadarEvent objects ────────────────────────────────────────
  const events: RadarEvent[] = []

  // Build a fast contact lookup
  const contactByEmail = new Map(enriched.map((c) => [c.email, c]))

  for (const [key, { mentions, canonical, isKnown }] of grouped) {
    const uniqueEmails = new Set(mentions.map((m) => m.contactEmail))

    // Build attendees first so we can check warmth for validation
    const seenEmails   = new Set<string>()
    const attendees:   EventAttendee[] = []
    const signalCounts = new Map<string, number>()

    for (const m of mentions) {
      const contact = contactByEmail.get(m.contactEmail)
      if (!contact || seenEmails.has(m.contactEmail)) continue
      seenEmails.add(m.contactEmail)

      const td = contact.twitterData!

      // Accumulate signals
      for (const s of td.signals ?? []) {
        signalCounts.set(s, (signalCounts.get(s) ?? 0) + 1)
      }

      attendees.push({
        email:            contact.email,
        name:             contact.name,
        companyName:      contact.companyName,
        domain:           contact.domain,
        twitterHandle:    td.handle,
        signals:          td.signals ?? [],
        interactionScore: contact.interactionScore,
        meetingCount:     contact.meetingCount,
        mentionContext:   m.tweet.length > 160 ? m.tweet.slice(0, 160) + "…" : m.tweet,
        role:             classifyRole(m.tweet),
      })
    }

    if (attendees.length === 0) continue

    const distinctCount  = uniqueEmails.size
    const hasWarmOrEmail = attendees.some((a) => attendeeWarmth(a) !== "cold")

    // ── Date / location — extracted early so the validation gate can use them ─
    const allText       = mentions.map((m) => m.tweet).join(" ")
    const estimatedDate = extractDate(allText)
    const location      = extractLocation(allText)
    const hasDateOrLocation = estimatedDate !== null || location !== null

    // ── Validation gate ──────────────────────────────────────────────────────
    // An event is only surfaced if there is hard social proof (2+ distinct people
    // independently mentioning it) OR concrete ground-truth evidence (an explicit
    // date or location in the tweets).  A single person mentioning an event name
    // with no supporting detail is indistinguishable from noise.
    if (distinctCount < 2 && !hasDateOrLocation) continue

    // ── Sort attendees warm-first ────────────────────────────────────────────
    attendees.sort((a, b) => {
      const wa = a.meetingCount > 0 || a.interactionScore >= 8 ? 2
               : a.interactionScore >= 3 ? 1 : 0
      const wb = b.meetingCount > 0 || b.interactionScore >= 8 ? 2
               : b.interactionScore >= 3 ? 1 : 0
      return wa !== wb ? wb - wa : b.interactionScore - a.interactionScore
    })

    // ── Signal summaries ─────────────────────────────────────────────────────
    const signals: EventSignalSummary[] = [...signalCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({
        type,
        label: SIGNAL_LABELS[type] ?? signalLabel(type),
        count,
      }))

    // ── Score gate ───────────────────────────────────────────────────────────
    const score = computeScore(attendees, signals)
    if (score < MIN_SCORE) continue

    const whyAttend = buildWhyAttend(attendees, signals, canonical)

    // ── Confidence ───────────────────────────────────────────────────────────
    // high: 2+ people AND (known date/location OR ≥1 warm contact), or 3+ people
    // medium: single person with date/location, or 2+ cold-only without date
    const confidence: "high" | "medium" =
      (distinctCount >= 2 && (hasDateOrLocation || hasWarmOrEmail)) || distinctCount >= 3
        ? "high"
        : "medium"

    // ── Description (known events only) ──────────────────────────────────────
    const description = DESCRIPTION_BY_CANONICAL.get(canonical) ?? null

    // ── Source evidence ───────────────────────────────────────────────────────
    const sourceEvidence = collectSourceEvidence(mentions, attendees, estimatedDate, location)

    events.push({
      id:            key.replace(/\s+/g, "-"),
      name:          canonical,
      mentionCount:  mentions.length,
      attendeeCount: attendees.length,
      people:        attendees,
      signals,
      estimatedDate,
      location,
      score,
      whyAttend,
      isKnown,
      confidence,
      description,
      sourceEvidence,
      relatedSurfaces: [],   // filled in by linkEventsToSurfaces() in the page
    })
  }

  // ── Step 4: sort by score, cap ───────────────────────────────────────────────
  return events
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_EVENTS)
}
