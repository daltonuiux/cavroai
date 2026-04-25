import { getAgencyProfile } from "@/lib/db"
import { AgencyProfileForm } from "@/components/agency-profile-form"

export default async function AgencyProfilePage() {
  let profile = null
  try {
    profile = await getAgencyProfile()
  } catch {
    // Show the empty form if DB is unreachable — user can still fill it out
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-foreground">
          Agency Profile
        </h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          This context is injected into every opportunity analysis so results are tailored to your agency.
        </p>
      </div>

      {!profile && (
        <div className="mb-5 rounded-md border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-[12px] font-medium text-amber-600 dark:text-amber-400">
            Profile not set up yet
          </p>
          <p className="mt-0.5 text-[12px] text-amber-600/70 dark:text-amber-400/70">
            Complete this profile before running analysis. Without it, opportunities will be generic and may not fit your agency.
          </p>
        </div>
      )}

      <div className="card-cavro rounded-md px-6">
        <AgencyProfileForm profile={profile} />
      </div>
    </div>
  )
}
