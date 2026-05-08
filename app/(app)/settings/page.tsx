import type { Metadata } from "next"

export const metadata: Metadata = { title: "Settings — Cavro AI" }

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-foreground">
          Settings
        </h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Company profile, audit preferences, and integrations
        </p>
      </div>

      <div className="max-w-xl space-y-6">

        {/* Company profile */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-foreground">Company</h2>
          <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">

            <div className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-foreground">Company URL</p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                  The primary URL Cavro AI audits against AI assistants
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="text-[12px] text-foreground/50 font-mono">acme.com</span>
                <button
                  className="rounded border border-border px-2.5 py-1 text-[11px] font-medium text-foreground/50 hover:text-foreground hover:border-foreground/30 transition-colors"
                  disabled
                >
                  Edit
                </button>
              </div>
            </div>

            <div className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-foreground">Company name</p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                  Used in audit reports and competitor comparisons
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="text-[12px] text-foreground/50">Acme Inc.</span>
                <button
                  className="rounded border border-border px-2.5 py-1 text-[11px] font-medium text-foreground/50 hover:text-foreground hover:border-foreground/30 transition-colors"
                  disabled
                >
                  Edit
                </button>
              </div>
            </div>

            <div className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-foreground">Product category</p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                  Helps Cavro AI select relevant buyer prompts
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="text-[12px] text-foreground/50">Knowledge management</span>
                <button
                  className="rounded border border-border px-2.5 py-1 text-[11px] font-medium text-foreground/50 hover:text-foreground hover:border-foreground/30 transition-colors"
                  disabled
                >
                  Edit
                </button>
              </div>
            </div>

          </div>
        </section>

        {/* Audit preferences */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-foreground">Audit preferences</h2>
          <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">

            <div className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-foreground">AI assistants</p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                  Which models are tested in each audit run
                </p>
              </div>
              <div className="shrink-0 flex flex-wrap gap-1 justify-end max-w-[200px]">
                {["ChatGPT", "Gemini", "Claude", "Perplexity", "Copilot", "Grok", "Llama"].map((m) => (
                  <span
                    key={m}
                    className="rounded bg-foreground/[0.05] px-1.5 py-px text-[10px] font-medium text-foreground/50"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>

            <div className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-foreground">Audit frequency</p>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                  How often Cavro AI runs automatic audits
                </p>
              </div>
              <span className="shrink-0 text-[12px] text-foreground/50">Bi-weekly</span>
            </div>

          </div>
        </section>

        {/* Account */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold text-foreground">Account</h2>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-[12px] text-muted-foreground">
              Account settings — billing, team members, and API access — coming soon.
            </p>
          </div>
        </section>

      </div>
    </div>
  )
}
