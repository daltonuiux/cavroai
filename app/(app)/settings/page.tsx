import type { Metadata } from "next"

export const metadata: Metadata = { title: "Settings — Cavro AI" }

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
      {children}
    </p>
  )
}

function SettingRow({
  label,
  sublabel,
  value,
}: {
  label:    string
  sublabel: string
  value:    React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/45">{sublabel}</p>
      </div>
      <div className="shrink-0 flex items-center gap-2.5">
        {value}
        <button
          disabled
          className="btn-cavro-secondary rounded-md border px-2.5 text-[11px] font-medium text-foreground/50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Edit
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8 max-w-2xl">

      {/* Header */}
      <div>
        <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-foreground">Settings</h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Company profile, audit preferences, and integrations
        </p>
      </div>

      {/* Company */}
      <section>
        <SectionLabel>Company</SectionLabel>
        <div className="card-cavro rounded-md divide-y divide-border overflow-hidden">
          <SettingRow
            label="Company URL"
            sublabel="The primary URL Cavro AI audits against AI assistants"
            value={<span className="text-[12px] font-mono text-foreground/50">acme.com</span>}
          />
          <SettingRow
            label="Company name"
            sublabel="Used in audit reports and competitor comparisons"
            value={<span className="text-[12px] text-foreground/50">Acme Inc.</span>}
          />
          <SettingRow
            label="Product category"
            sublabel="Helps Cavro AI select relevant buyer prompts"
            value={<span className="text-[12px] text-foreground/50">Knowledge management</span>}
          />
        </div>
      </section>

      {/* Audit preferences */}
      <section>
        <SectionLabel>Audit preferences</SectionLabel>
        <div className="card-cavro rounded-md divide-y divide-border overflow-hidden">

          <div className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground">AI assistants</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/45">
                Models tested in each audit run
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

          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground">Audit frequency</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/45">
                How often Cavro AI runs automatic audits
              </p>
            </div>
            <span className="text-[12px] text-foreground/50">Bi-weekly</span>
          </div>

        </div>
      </section>

      {/* Account */}
      <section>
        <SectionLabel>Account</SectionLabel>
        <div className="card-cavro rounded-md px-4 py-3">
          <p className="text-[12px] text-muted-foreground">
            Billing, team members, and API access coming soon.
          </p>
        </div>
      </section>

    </div>
  )
}
