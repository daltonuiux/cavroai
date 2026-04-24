import { generateOpportunities } from "@/lib/opportunities"
import { OpportunitiesList } from "@/components/opportunities-list"

export default function OpportunitiesPage() {
  const leads = generateOpportunities()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-foreground">
          Opportunities
        </h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Companies you should reach out to this week
        </p>
      </div>

      <OpportunitiesList leads={leads} />
    </div>
  )
}
