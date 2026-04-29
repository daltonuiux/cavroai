/**
 * Events Radar — surfaces relevant events based on network activity.
 *
 * Answers: "Where should I show up?"
 *
 * Algorithm
 * ─────────
 * 1. Scan each enriched contact's tweetSamples for event mentions:
 *    a. Known events — match against a curated alias table (high precision)
 *    b. Unknown events — extract capitalized phrases after attendance verbs
 * 2. Normalise candidate names (strip years, lowercase for dedup key)
 * 3. Group mentions by normalised key
 *    - Known events: surface with ≥1 contact
 *    - Unknown events: require ≥2 distinct contacts (noise filter)
 * 4. For each event, collect attendees, aggregate signals, detect date/location
 * 5. Score and sort — cap at MAX_EVENTS
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
}

// ---------------------------------------------------------------------------
// Curated known-events table
// ---------------------------------------------------------------------------

interface KnownEvent {
  canonical: string
  /** All strings that should map to this event (lowercase). */
  aliases:   string[]
}

const KNOWN_EVENTS: KnownEvent[] = [
  {
    canonical: "SXSW",
    aliases:   ["sxsw", "south by southwest", "south by", "southbysouthwest"],
  },
  {
    canonical: "Config",
    aliases:   ["figma config", "config", "config sf", "config 2025", "config 2026"],
  },
  {
    canonical: "Product Hunt",
    aliases:   ["product hunt", "producthunt"],
  },
  {
    canonical: "TC Disrupt",
    aliases:   ["techcrunch disrupt", "tc disrupt", "disrupt sf", "techcrunch"],
  },
  {
    canonical: "Y Combinator",
    aliases:   ["y combinator", "ycombinator", "yc demo day", "yc demoday", "demo day"],
  },
  {
    canonical: "Web Summit",
    aliases:   ["web summit", "websummit"],
  },
  {
    canonical: "Apple WWDC",
    aliases:   ["wwdc", "apple wwdc"],
  },
  {
    canonical: "Google I/O",
    aliases:   ["google i/o", "google io"],
  },
  {
    canonical: "AWS re:Invent",
    aliases:   ["aws reinvent", "aws re:invent", "reinvent"],
  },
  {
    canonical: "NeurIPS",
    aliases:   ["neurips", "nips conference"],
  },
  {
    canonical: "Dreamforce",
    aliases:   ["dreamforce"],
  },
  {
    canonical: "SaaStr Annual",
    aliases:   ["saastr", "saastr annual"],
  },
  {
    canonical: "Collision",
    aliases:   ["collision conf", "collision conference", "collision"],
  },
  {
    canonical: "Slush",
    aliases:   ["slush", "slush helsinki"],
  },
  {
    canonical: "VivaTech",
    aliases:   ["vivatech", "viva technology"],
  },
  {
    canonical: "CES",
    aliases:   ["ces", "consumer electronics show"],
  },
  {
    canonical: "Cannes Lions",
    aliases:   ["cannes lions", "cannes"],
  },
  {
    canonical: "AngelConf",
    aliases:   ["angelconf", "angel conf"],
  },
  {
    canonical: "Signal",
    aliases:   ["signal conference", "signal conf"],
  },
  {
    canonical: "Seed Summit",
    aliases:   ["seed summit"],
  },
  {
    canonical: "TNW",
    aliases:   ["tnw", "the next web"],
  },
  {
    canonical: "Figma Config",
    aliases:   ["figma config 2025", "figma config 2026"],
  },
  {
    canonical: "Intersect",
    aliases:   ["intersect festival", "intersect conf"],
  },
]

// ---------------------------------------------------------------------------
// Attendance patterns — extract unknown events from tweet text
// ---------------------------------------------------------------------------

/**
 * Each regex has exactly one capture group containing the event-name candidate.
 * Pattern: attendance verb → capitalized phrase (1–3 words).
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
  recommendation: "Looking for help",
  pain:           "Expressed need",
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function attendeeWarmth(a: EventAttendee): "warm" | "email" | "cold" {
  if (a.meetingCount > 0 || a.interactionScore >= 8) return "warm"
  if (a.interactionScore >= 3)                       return "email"
  return "cold"
}

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

function buildWhyAttend(
  attendees:   EventAttendee[],
  signals:     EventSignalSummary[],
  _eventName:  string,
): string {
  const warmPeople  = attendees.filter((a) => attendeeWarmth(a) === "warm")
  const emailPeople = attendees.filter((a) => attendeeWarmth(a) === "email")
  const speakers    = attendees.filter((a) => a.role === "speaker")
  const topSignal   = signals[0]

  const firstName = (a: EventAttendee) =>
    a.name?.split(" ")[0] ?? a.email.split("@")[0]

  // ── Part 1: signal or attendance density ────────────────────────────────────
  let opening: string

  if (speakers.length >= 2) {
    const names = speakers.slice(0, 2).map(firstName).join(" and ")
    opening = `${names} are speaking — your network has a direct line into the room.`
  } else if (speakers.length === 1) {
    opening = `${firstName(speakers[0])} is speaking — a natural anchor for the event and an easy conversation starter.`
  } else if (topSignal && topSignal.count >= 2) {
    if (topSignal.type === "launching" || topSignal.type === "fundraising") {
      opening = `${topSignal.count} of your contacts attending are ${SIGNAL_LABELS[topSignal.type]?.toLowerCase() ?? topSignal.type} — high receptivity for new partnerships right now.`
    } else if (topSignal.type === "recommendation" || topSignal.type === "pain") {
      opening = `${topSignal.count} attending contacts have expressed an active need for support — a direct signal this is worth your time.`
    } else {
      opening = `${topSignal.count} contacts here are ${SIGNAL_LABELS[topSignal.type]?.toLowerCase() ?? topSignal.type} — strong momentum in this part of your network.`
    }
  } else if (attendees.length >= 4) {
    opening = `${attendees.length} people from your network are going — one of the highest concentrations in your radar.`
  } else {
    const count = attendees.length
    opening = `${count} ${count === 1 ? "contact" : "contacts"} from your network ${count === 1 ? "is" : "are"} attending.`
  }

  // ── Part 2: relationship angle ───────────────────────────────────────────────
  let relationship: string

  if (warmPeople.length >= 3) {
    relationship = `You've already met ${warmPeople.length} of them — showing up turns warm into warm-in-person.`
  } else if (warmPeople.length === 2) {
    const names = warmPeople.map(firstName).join(" and ")
    relationship = `You know ${names} personally — natural anchors that make working the room far easier.`
  } else if (warmPeople.length === 1 && emailPeople.length >= 1) {
    relationship = `You've met ${firstName(warmPeople[0])} and have email history with ${emailPeople.length} other${emailPeople.length > 1 ? "s" : ""} — well-positioned to make real connections here.`
  } else if (warmPeople.length === 1) {
    relationship = `You know ${firstName(warmPeople[0])} personally — a solid anchor for the event.`
  } else if (emailPeople.length >= 2) {
    relationship = `You have email history with ${emailPeople.length} of them — warm enough to pick up the conversation in person.`
  } else if (emailPeople.length === 1) {
    relationship = `You've exchanged emails with ${firstName(emailPeople[0])} — a low-friction starting point.`
  } else {
    relationship = `These are loose connections, but a shared event creates exactly the context needed for genuine first introductions.`
  }

  // ── Part 3: closing action prompt ────────────────────────────────────────────
  const action = attendees.length >= 3
    ? "Strong networking ROI relative to the time investment."
    : "Worth a look — the right small event often beats a crowded conference."

  return [opening, relationship, action].join(" ")
}

// ---------------------------------------------------------------------------
// Core export
// ---------------------------------------------------------------------------

/** Minimum distinct contacts required for an *unknown* event to surface. */
const MIN_UNKNOWN_CONTACTS = 2

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
    // Filter: unknown events need ≥2 distinct contacts
    const uniqueEmails = new Set(mentions.map((m) => m.contactEmail))
    if (!isKnown && uniqueEmails.size < MIN_UNKNOWN_CONTACTS) continue

    // Build attendees — one per unique contact, preserving their best mention
    const seenEmails  = new Set<string>()
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
        mentionContext:   m.tweet.length > 140 ? m.tweet.slice(0, 140) + "…" : m.tweet,
        role:             classifyRole(m.tweet),
      })
    }

    if (attendees.length === 0) continue

    // Sort attendees warm-first, then by interaction score
    attendees.sort((a, b) => {
      const wa = a.meetingCount > 0 || a.interactionScore >= 8 ? 2
               : a.interactionScore >= 3 ? 1 : 0
      const wb = b.meetingCount > 0 || b.interactionScore >= 8 ? 2
               : b.interactionScore >= 3 ? 1 : 0
      return wa !== wb ? wb - wa : b.interactionScore - a.interactionScore
    })

    // Build signal summaries
    const signals: EventSignalSummary[] = [...signalCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({
        type,
        label: SIGNAL_LABELS[type] ?? signalLabel(type),
        count,
      }))

    // Combine all tweet text for date/location extraction
    const allText     = mentions.map((m) => m.tweet).join(" ")
    const estimatedDate = extractDate(allText)
    const location      = extractLocation(allText)
    const score         = computeScore(attendees, signals)
    const whyAttend     = buildWhyAttend(attendees, signals, canonical)

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
    })
  }

  // ── Step 4: sort by score, cap ───────────────────────────────────────────────
  return events
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_EVENTS)
}
