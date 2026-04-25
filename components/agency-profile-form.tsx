"use client"

import { useRef, useState, useTransition } from "react"
import { saveAgencyProfile } from "@/app/profile/actions"
import type { AgencyProfile } from "@/lib/types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function join(arr: string[] | undefined): string {
  return arr?.join(", ") ?? ""
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1.5"
    >
      {children}
    </label>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[11px] text-muted-foreground/40">{children}</p>
}

function Input({
  id,
  name,
  defaultValue,
  placeholder,
  type = "text",
}: {
  id: string
  name: string
  defaultValue?: string | number
  placeholder?: string
  type?: string
}) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      defaultValue={defaultValue ?? ""}
      placeholder={placeholder}
      className="w-full h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
    />
  )
}

function Textarea({
  id,
  name,
  defaultValue,
  placeholder,
  rows = 2,
}: {
  id: string
  name: string
  defaultValue?: string
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      id={id}
      name={name}
      defaultValue={defaultValue ?? ""}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20 resize-none"
    />
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 py-5 border-b border-border last:border-0">
      <p className="text-[12px] font-semibold text-foreground/60 uppercase tracking-widest">
        {title}
      </p>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------

export function AgencyProfileForm({ profile }: { profile: AgencyProfile | null }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await saveAgencyProfile(formData)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col">

      <Section title="Agency">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="agencyName">Agency name</Label>
            <Input
              id="agencyName"
              name="agencyName"
              defaultValue={profile?.agencyName}
              placeholder="Acme Studio"
            />
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              name="website"
              defaultValue={profile?.website}
              placeholder="https://acme.studio"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="positioning">One-line positioning</Label>
          <Input
            id="positioning"
            name="positioning"
            defaultValue={profile?.positioning}
            placeholder="We help B2B SaaS companies turn complex products into clear growth stories."
          />
          <Hint>The one sentence that explains who you help and how.</Hint>
        </div>
      </Section>

      <Section title="Services &amp; Clients">
        <div>
          <Label htmlFor="services">Services offered</Label>
          <Textarea
            id="services"
            name="services"
            defaultValue={join(profile?.services)}
            placeholder="Brand strategy, Website design, Content, Growth marketing"
          />
          <Hint>Comma-separated list of your core services.</Hint>
        </div>
        <div>
          <Label htmlFor="idealClientTypes">Ideal client types</Label>
          <Textarea
            id="idealClientTypes"
            name="idealClientTypes"
            defaultValue={join(profile?.idealClientTypes)}
            placeholder="Series A–C SaaS, B2B tech companies, Product-led growth startups"
          />
          <Hint>Comma-separated. Be specific — this drives opportunity scoring.</Hint>
        </div>
        <div>
          <Label htmlFor="industries">Industries served</Label>
          <Textarea
            id="industries"
            name="industries"
            defaultValue={join(profile?.industries)}
            placeholder="Developer tools, HR tech, Fintech, MarTech"
          />
          <Hint>Comma-separated list of verticals you work in.</Hint>
        </div>
      </Section>

      <Section title="Budget &amp; Geography">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="minBudget">Min budget (£)</Label>
            <Input
              id="minBudget"
              name="minBudget"
              type="number"
              defaultValue={profile?.minBudget}
              placeholder="10000"
            />
          </div>
          <div>
            <Label htmlFor="maxBudget">Max budget (£)</Label>
            <Input
              id="maxBudget"
              name="maxBudget"
              type="number"
              defaultValue={profile?.maxBudget}
              placeholder="150000"
            />
          </div>
          <div>
            <Label htmlFor="geography">Geography</Label>
            <Input
              id="geography"
              name="geography"
              defaultValue={profile?.geography}
              placeholder="UK, Europe, Remote"
            />
          </div>
        </div>
      </Section>

      <Section title="Proof Points">
        <div>
          <Label htmlFor="proofPoints">Case study strengths</Label>
          <Textarea
            id="proofPoints"
            name="proofPoints"
            rows={3}
            defaultValue={join(profile?.proofPoints)}
            placeholder="Helped Acme double trial-to-paid conversion, Rebuilt Contoso's onboarding flow"
          />
          <Hint>
            Comma-separated. These are injected into pitches to demonstrate relevant experience.
          </Hint>
        </div>
      </Section>

      <Section title="Bad Fits">
        <div>
          <Label htmlFor="badFitClients">Bad-fit clients</Label>
          <Textarea
            id="badFitClients"
            name="badFitClients"
            defaultValue={join(profile?.badFitClients)}
            placeholder="B2C companies, Agencies, Regulated industries, Pre-revenue startups"
          />
          <Hint>
            Comma-separated. Opportunities matching these will be suppressed or flagged.
          </Hint>
        </div>
      </Section>

      <div className="flex items-center gap-3 pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground px-4 py-2 text-[13px] font-semibold text-background transition-opacity disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save profile"}
        </button>
        {saved && (
          <span className="text-[12px] text-emerald-600 dark:text-emerald-400">
            Profile saved
          </span>
        )}
      </div>

    </form>
  )
}
