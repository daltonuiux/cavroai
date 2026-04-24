import type { Signals, SignalChange, ChangeType } from "./types"

const CHANGE_SUMMARY: Record<ChangeType, (c: SignalChange) => string> = {
  blog: (c) => c.title,   // "1 new blog post published"
  jobs: (c) => c.title,   // "2 new roles posted"
  pricing: () => "Pricing page updated",
  website: () => "Homepage messaging changed",
}

export function summarizeChanges(changes: SignalChange[]): string[] {
  return changes.map((c) => CHANGE_SUMMARY[c.type]?.(c) ?? c.title)
}

function jaccardSimilarity(a: string, b: string): number {
  const aWords = new Set(a.toLowerCase().split(/\s+/).filter(Boolean))
  const bWords = new Set(b.toLowerCase().split(/\s+/).filter(Boolean))
  if (aWords.size === 0 && bWords.size === 0) return 1
  const intersection = [...aWords].filter((w) => bWords.has(w)).length
  const union = aWords.size + bWords.size - intersection
  return union === 0 ? 1 : intersection / union
}

export function detectChanges(prev: Signals, curr: Signals): SignalChange[] {
  const changes: SignalChange[] = []

  // Blog: new titles not seen before
  const prevTitles = new Set(prev.blog.map((p) => p.title.toLowerCase().trim()))
  const newPosts = curr.blog.filter((p) => !prevTitles.has(p.title.toLowerCase().trim()))
  if (newPosts.length > 0) {
    changes.push({
      type: "blog",
      title: `${newPosts.length} new blog post${newPosts.length > 1 ? "s" : ""} published`,
      description: newPosts.map((p) => `"${p.title}"`).join(", "),
      impact: "Watch the topic shift. New content targets a new audience, and the homepage usually follows.",
    })
  }

  // Jobs: new roles not seen before
  const prevRoles = new Set(prev.jobs.map((j) => j.title.toLowerCase().trim()))
  const newRoles = curr.jobs.filter((j) => !prevRoles.has(j.title.toLowerCase().trim()))
  if (newRoles.length > 0) {
    changes.push({
      type: "jobs",
      title: `${newRoles.length} new role${newRoles.length > 1 ? "s" : ""} posted`,
      description: newRoles.map((j) => j.title).join(", "),
      impact: "Hiring is the earliest signal of a direction change. Product and pricing shifts usually follow 2 to 3 quarters later.",
    })
  }

  // Pricing: significant text change
  if (prev.website.pricing && curr.website.pricing) {
    const sim = jaccardSimilarity(prev.website.pricing, curr.website.pricing)
    if (sim < 0.85) {
      changes.push({
        type: "pricing",
        title: "Pricing page content changed",
        description: "Text on the pricing page has diverged significantly since last analysis",
        impact: "Check for new tiers, removed features, or rewritten positioning. Pricing page changes are usually deliberate.",
      })
    }
  } else if (!prev.website.pricing && curr.website.pricing) {
    changes.push({
      type: "pricing",
      title: "Pricing page now accessible",
      description: "A /pricing page was found that wasn't available during the previous analysis",
      impact: "New pricing visibility may indicate a shift toward self-serve or a new commercial tier being tested",
    })
  }

  // Homepage: significant text change
  if (prev.website.homepage && curr.website.homepage) {
    const sim = jaccardSimilarity(prev.website.homepage, curr.website.homepage)
    if (sim < 0.80) {
      changes.push({
        type: "website",
        title: "Homepage messaging changed significantly",
        description: "Homepage content has diverged meaningfully since last analysis. This may signal a repositioning or product launch.",
        impact: "Homepage rewrites are deliberate. Look for audience, positioning, or competitive framing changes.",
      })
    }
  }

  return changes
}
