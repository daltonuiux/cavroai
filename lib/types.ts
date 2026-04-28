export type RelationshipType = "current_client" | "past_client" | "warm" | "cold"

export interface ClientContact {
  name: string
  role: string
  linkedin?: string
}

export interface Client {
  id: string
  name: string
  websiteUrl: string
  createdAt: string
  relationshipType?: RelationshipType
  services?: string[]
  contact?: ClientContact
  focus?: string
  connections?: string[]
}

export type ImpactLevel = "low" | "medium" | "high"

export interface RecommendedAction {
  title: string
  description: string
  relatedOpportunity?: string
}

export type Momentum = "new" | "increased" | "cooling"

export interface Opportunity {
  title: string
  impact: ImpactLevel
  headline: string
  warmReason?: string
  signals: string[]
  whatsHappening: string
  whatToDo: string
  outreach: string
  momentum?: Momentum
}

export type ChangeType = "blog" | "jobs" | "pricing" | "website"

export interface SignalChange {
  type: ChangeType
  title: string
  description: string
  impact: string
}

// Each evidence item pairs a plain-language claim with the exact source phrase
// that supports it, so every analysis claim is traceable back to scraped text.
export interface EvidenceItem {
  claim: string
  sourceText: string
}

// ---------------------------------------------------------------------------
// Agency profile — describes the user's own agency so analysis can assess fit
// ---------------------------------------------------------------------------

export interface AgencyProfile {
  id: string
  userId?: string
  agencyName: string
  website?: string
  positioning?: string
  services: string[]
  idealClientTypes: string[]
  industries: string[]
  minBudget?: number
  maxBudget?: number
  geography?: string
  proofPoints: string[]
  badFitClients: string[]
  createdAt: string
  updatedAt: string
}

export interface Analysis {
  id: string
  clientId: string
  status: "pending" | "complete" | "error" | "insufficient_data" | "profile_only"
  summary: string
  strategicDirection: string[]
  opportunities: Opportunity[]
  suggestedPitch: string
  recommendedActions?: RecommendedAction[]
  changes?: SignalChange[]
  changeSummary?: string[]
  signals?: Signals
  lastSignals?: Signals
  lastAnalyzedAt?: string
  errorMessage?: string
  createdAt: string
  // Evidence-based fields — requires DB migration: see lib/db.ts header comment
  showOpportunity?: boolean
  evidence?: EvidenceItem[]
  whatIsHappening?: string
  whatToDo?: string
  outreach?: string
  // Agency fit fields — requires DB migration: see lib/db.ts header comment
  fitScore?: number
  fitReason?: string
  // Lightweight profile — always extracted, even when score is too low for full analysis
  clientProfile?: ClientProfile
}

export interface DB {
  clients: Client[]
  analyses: Analysis[]
}

// ---------------------------------------------------------------------------
// Client profile — lightweight, always-on extraction (runs before scoring)
// ---------------------------------------------------------------------------

/**
 * Lightweight profile extracted from any website regardless of signal strength.
 * Used to power similar-company generation even when opportunity signals are weak.
 */
export interface ClientProfile {
  category: string            // e.g. "B2B SaaS", "developer tool"
  productDescription: string  // 1-2 sentence description from homepage copy
  targetCustomer: string      // who the product is for
  industry: string            // primary industry
  keywords: string[]          // 3-6 descriptive tags
  evidence: string[]          // verbatim phrases from homepage that support the above
}

// ---------------------------------------------------------------------------
// Deal sourcing — company profiling and prospect generation
// ---------------------------------------------------------------------------

/** Derived profile of the target company, used to find similar prospects. */
export interface CompanyProfile {
  category: string         // e.g. "AI sales tool", "SaaS analytics platform"
  targetCustomer: string   // e.g. "SaaS founders", "enterprise security teams"
  productType: string      // e.g. "B2B SaaS", "marketplace", "developer tool"
  keywords: string[]       // 3–6 descriptive tags
}

// ---------------------------------------------------------------------------
// Warm Path Engine — relationship signal extraction and intro mapping
// ---------------------------------------------------------------------------

export type EntityType =
  | "partner"
  | "company"
  | "investor"
  | "tool"
  | "person"
  | "community"

// ---------------------------------------------------------------------------
// Network seeds — manually seeded relationships (agency's own network)
// ---------------------------------------------------------------------------

export type SeedEntityType =
  | "person"
  | "company"
  | "investor"
  | "partner"
  | "tool"
  | "community"

export type SeedRelationshipType =
  | "knows"
  | "worked_with"
  | "client"
  | "partner"
  | "investor"
  | "ecosystem"
  | "uses"
  | "member_of"

/**
 * The source of a warm path:
 *   "scraped" — both clients have scraped relationship signals for this entity
 *   "seed"    — only a manual seed (no client match), shown in Network page only
 *   "both"    — a manual seed + 1+ client relationship signals
 */
export type WarmPathSource = "scraped" | "seed" | "both"

/**
 * A manually seeded relationship — represents the agency's own known network.
 * Seeds are combined with scraped relationship_signals to strengthen warm paths.
 */
export interface RelationshipSeed {
  id: string
  userId: string
  entityName: string
  entityType: SeedEntityType
  relationshipType: SeedRelationshipType
  /** Optional label describing how/where you know this entity, e.g. "Met at SaaStr 2024" */
  sourceLabel?: string
  /** Free-form notes about this relationship */
  notes?: string
  strength: "strong" | "medium" | "weak"
  createdAt: string
}

export type RelationshipSignalType =
  | "uses"
  | "partner"
  | "customer"
  | "invested_by"
  | "employee"
  | "founder"
  | "mentioned"

export interface RelationshipSignal {
  id: string
  clientId: string
  userId: string
  entityName: string
  entityType: EntityType
  relationshipType?: RelationshipSignalType
  sourceUrl?: string
  sourceContext?: string
  confidence: "high" | "medium" | "low"
  createdAt: string
}

export interface WarmPath {
  entityName: string
  /** Strongest entity type found across all matching clients */
  entityType: EntityType
  strength: "strong" | "medium" | "weak"
  clients: Array<{ id: string; name: string }>
  reason: string
  whyItMatters: string
  /** Whether this path comes from scraping, a manual seed, or both */
  source: WarmPathSource
  /** Notes from the matching seed, if any */
  seedNotes?: string
}

/**
 * A named, actionable intro suggestion derived from a warm path.
 * Generated at read-time from client contacts + person relationship signals.
 * Never invented — only produced when supporting data exists.
 */
export interface NamedIntro {
  sourceClient: string           // name of the source client we're asking through
  sourceContact: string | null   // named contact at source client (null = ask generically)
  viaEntity: string              // title-cased shared entity name
  suggestedAsk: string           // ready-to-use ask sentence
  confidence: "low" | "medium" | "high"
  /** Named people found at the target from relationship_signals (entity_type = "person") */
  targetPeople?: string[]
}

/**
 * A single warm intro path attached to an opportunity row.
 * Derived at read-time from the global warm paths index — not stored in DB.
 */
export interface OpportunityWarmPath {
  viaEntity: string
  viaType: string
  /** Comma-joined names of the other clients that share this entity */
  sourceClients: string
  strength: "strong" | "medium" | "weak"
  explanation: string
  suggestedApproach: string
  /** Named intro suggestions for this path — empty when no supporting data */
  namedIntros: NamedIntro[]
}

/** A suggested company to pursue, generated from a source client's profile. */
export interface Prospect {
  id: string
  sourceClientId: string
  name: string
  reason: string
  estimatedFit: "high" | "medium" | "low"
  /** Set once the user adds this prospect as a tracked client. */
  addedAsClientId?: string
  createdAt: string
}

export interface WebsiteSignals {
  homepage: string
  pricing?: string
  product?: string
}

export interface BlogPost {
  title: string
  summary: string
}

export interface JobRole {
  title: string
}

export interface NewsItem {
  headline: string
}

export interface ExtractedSignals {
  headings: string[]
  keywords: string[]
  hasCareersPage: boolean
  hasBlog: boolean
  hasPricing: boolean
  /** <title> text — populated by extractPageSignals() */
  pageTitle?: string
  /** <meta name="description"> content — populated by extractPageSignals() */
  metaDescription?: string
  /** First meaningful paragraph outside nav/header/footer — cleaner than raw homepage text */
  firstParagraph?: string
  /** Company names extracted from logo img alt attributes on the homepage */
  logoAlts?: string[]
}

export interface JobSignals {
  /** True if a /careers or /jobs page was reachable, or a job board link was found. */
  hasJobsPage: boolean
  /** Detected job board provider name, e.g. "greenhouse", "lever", "ashby". */
  jobBoardProvider: string | null
  /** Full URL of the detected job board link. */
  jobBoardUrl: string | null
  /** All job-like headings extracted from careers/jobs pages. */
  roles: string[]
  /** Subset of roles matching commercially-relevant patterns. */
  commercialRoles: string[]
}

export interface NewsArticle {
  title: string
  date: string
}

export interface NewsSignals {
  hasNews: boolean
  articles: NewsArticle[]
  /** Keywords matched in filtered article titles, e.g. "launch", "raises". */
  keywords: string[]
  /** Total raw articles from RSS before business-relevance filtering. */
  rawCount: number
  /** Articles dropped because company name was not a whole word in the title, or a reject pattern fired. */
  entityRejected: number
  /** Articles dropped because no business keyword was present (after entity check passed). */
  keywordRejected: number
}

// ---------------------------------------------------------------------------
// Enriched signals — structured, typed, confidence-scored
// ---------------------------------------------------------------------------

export type EnrichedSignalType = "hiring" | "activity" | "product" | "content"

/**
 * A single extracted signal with enough context to drive AI reasoning.
 * confidence: 0.0–1.0 (1.0 = certain, e.g. named job role; 0.5 = inferred from keyword)
 */
export interface EnrichedSignal {
  type: EnrichedSignalType
  text: string       // the extracted sentence, title, or role name
  source: string     // "careers page" | "homepage" | "product page" | "blog" | "news"
  confidence: number // 0.0–1.0
}

export interface EnrichedSignals {
  hiring:   EnrichedSignal[]  // roles + hiring language — highest priority
  activity: EnrichedSignal[]  // launch / announce / new product sentences
  product:  EnrichedSignal[]  // onboarding / dashboard / automation sentences
  content:  EnrichedSignal[]  // blog post titles and content signals
}

// ---------------------------------------------------------------------------
// External enrichment — Exa / Tavily / mock provider output
// ---------------------------------------------------------------------------

/**
 * Structured output from an external enrichment provider (Exa, Tavily, mock).
 * Stored as-is in analysis.signals.enrichmentResult for display and conversion.
 *
 * status:
 *   "ok"             — provider ran and returned data (arrays may still be empty)
 *   "error"          — provider threw; signals are empty
 *   "not_configured" — ENRICHMENT_PROVIDER env var is not set
 */
export interface EnrichmentResult {
  provider:        string
  status:          "ok" | "error" | "not_configured"
  fundingSignals:  string[]  // "Series B — Sequoia Capital — $20M", "Seed — Y Combinator"
  hiringSignals:   string[]  // "Account Executive (Remote)", "Senior Product Designer"
  customerSignals: string[]  // clean company names: "Stripe", "Notion"
  partnerSignals:  string[]  // clean company names: "HubSpot", "Salesforce"
  peopleSignals:   string[]  // "Sarah Chen — Co-founder & CEO"
  newsSignals:     string[]  // article headlines
  sourceUrls:      string[]  // provenance URLs used by the provider
}

// ---------------------------------------------------------------------------
// LinkedIn — placeholder schema (scraping not yet implemented)
// ---------------------------------------------------------------------------

export interface LinkedInSignals {
  /** Total employee count shown on the company LinkedIn page. */
  employees?: number
  /** Named roles or departments visible on the page. */
  roles?: string[]
  /** Shared connections between the agency and this company. */
  connections?: string[]
  /** Whether LinkedIn data has been fetched (false = placeholder only). */
  fetched: boolean
}

export interface Signals {
  website: WebsiteSignals
  blog: BlogPost[]
  jobs: JobRole[]
  news: NewsItem[]
  extracted?: ExtractedSignals
  jobSignals?: JobSignals
  newsSignals?: NewsSignals
  /** Structured enriched signals — populated during gatherSignals(), always present. */
  enrichedSignals?: EnrichedSignals
  /** LinkedIn placeholder — structure reserved, not yet scraped. */
  linkedin?: LinkedInSignals
  /** External enrichment results (Exa/Tavily/mock) — undefined if analysis predates this feature. */
  enrichmentResult?: EnrichmentResult
}
