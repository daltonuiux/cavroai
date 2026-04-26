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
  status: "pending" | "complete" | "error" | "insufficient_data"
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
}

export interface DB {
  clients: Client[]
  analyses: Analysis[]
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
