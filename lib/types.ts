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
  | "integration"
  | "customer"
  | "investor"
  | "tool"
  | "person"

export interface RelationshipSignal {
  id: string
  clientId: string
  userId: string
  entityName: string
  entityType: EntityType
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

export interface Signals {
  website: WebsiteSignals
  blog: BlogPost[]
  jobs: JobRole[]
  news: NewsItem[]
  extracted?: ExtractedSignals
  jobSignals?: JobSignals
  newsSignals?: NewsSignals
}
