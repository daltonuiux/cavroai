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

export interface Analysis {
  id: string
  clientId: string
  status: "pending" | "complete" | "error"
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

export interface Signals {
  website: WebsiteSignals
  blog: BlogPost[]
  jobs: JobRole[]
  news: NewsItem[]
}
