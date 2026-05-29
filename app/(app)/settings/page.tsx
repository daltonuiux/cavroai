import type { Metadata } from "next"

export const metadata: Metadata = { title: "Settings — Kaelor AI" }

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
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
        <p className="mt-0.5 text-[11px] text-zinc-500">{sublabel}</p>
      </div>
      <div className="shrink-0 flex items-center gap-2.5">
        {value}
        <button
          disabled
          className="btn-kaelor-secondary rounded-md border px-2.5 text-[11px] font-medium text-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed"
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
        <div className="card-kaelor rounded-md divide-y divide-border overflow-hidden">
          <SettingRow
            label="Company URL"
            sublabel="The primary URL Kaelor AI audits against AI assistants"
            value={<span className="text-[12px] font-mono text-zinc-500">acme.com</span>}
          />
          <SettingRow
            label="Company name"
            sublabel="Used in audit reports and competitor comparisons"
            value={<span className="text-[12px] text-zinc-500">Acme Inc.</span>}
          />
          <SettingRow
            label="Product category"
            sublabel="Helps Kaelor AI select relevant buyer prompts"
            value={<span className="text-[12px] text-zinc-500">Knowledge management</span>}
          />
        </div>
      </section>

      {/* Audit preferences */}
      <section>
        <SectionLabel>Audit preferences</SectionLabel>
        <div className="card-kaelor rounded-md divide-y divide-border overflow-hidden">

          <div className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground">AI assistants</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Models tested in each audit run
              </p>
            </div>
            <div className="shrink-0 flex flex-wrap gap-1 justify-end max-w-[200px]">
              {["ChatGPT", "Gemini", "Claude", "Perplexity", "Copilot", "Grok", "Llama"].map((m) => (
                <span
                  key={m}
                  className="rounded bg-foreground/[0.05] px-1.5 py-px text-[10px] font-medium text-zinc-500"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-foreground">Audit frequency</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                How often Kaelor AI runs automatic audits
              </p>
            </div>
            <span className="text-[12px] text-zinc-500">Bi-weekly</span>
          </div>

        </div>
      </section>

      {/* Account */}
      <section>
        <SectionLabel>Account</SectionLabel>
        <div className="card-kaelor rounded-md px-4 py-3">
          <p className="text-[12px] text-muted-foreground">
            Billing, team members, and API access coming soon.
          </p>
        </div>
      </section>

    </div>
  )
}
