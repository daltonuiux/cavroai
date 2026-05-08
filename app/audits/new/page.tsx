"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Plus, X } from "lucide-react"
import { generateMockAudit } from "@/lib/audit-mock"
import type { AuditResult } from "@/lib/audit-mock"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  "CRM",
  "Project management",
  "Knowledge management",
  "Analytics",
  "Customer support",
  "Marketing automation",
  "HR & recruiting",
  "Finance & billing",
  "Developer tools",
  "Sales intelligence",
  "Product management",
  "Design tools",
  "Other",
]

const PROMPT_EXAMPLES = [
  "Best CRM for early-stage SaaS teams",
  "Top AI meeting note tools for startups",
  "Best Stripe affiliate software",
  "Which product analytics tool should I use?",
  "Notion alternatives for engineering teams",
  "Best customer support tool for small businesses",
]

const LOADING_STEPS = [
  "Reviewing positioning clarity",
  "Comparing competitor messaging",
  "Mapping prompt relevance",
  "Checking trust signals",
  "Preparing recommendations",
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 1 | 2 | 3 | 4 | "loading"

interface FormData {
  company:     string
  url:         string
  category:    string
  description: string
  competitors: string[]
  prompts:     string[]
}

// ---------------------------------------------------------------------------
// Small shared primitives
// ---------------------------------------------------------------------------

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[12px] font-medium text-foreground/65 mb-1.5">
      {children}
    </label>
  )
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/35 focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-shadow"
    />
  )
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/35 focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-shadow"
    />
  )
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 transition-shadow"
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: 1 | 2 | 3 | 4 }) {
  const steps = ["Company", "Competitors", "Prompts", "Review"]
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const idx    = i + 1
        const active = idx === current
        const done   = idx < current
        return (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={[
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-colors",
                  done   ? "bg-foreground text-background"
                  : active ? "bg-foreground text-background"
                  : "bg-foreground/10 text-foreground/30",
                ].join(" ")}
              >
                {done ? <Check size={10} strokeWidth={3} /> : idx}
              </div>
              <span
                className={[
                  "text-[12px] font-medium transition-colors",
                  active ? "text-foreground" : "text-foreground/35",
                ].join(" ")}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="mx-3 h-px w-8 bg-border" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1 — Company
// ---------------------------------------------------------------------------

function Step1({
  form,
  update,
  onNext,
}: {
  form: FormData
  update: (patch: Partial<FormData>) => void
  onNext: () => void
}) {
  const valid = form.company.trim() !== "" && form.url.trim() !== ""

  return (
    <div>
      <StepIndicator current={1} />
      <h2 className="text-[16px] font-semibold text-foreground tracking-[-0.015em] mb-1">
        Tell us about your company
      </h2>
      <p className="text-[12px] text-muted-foreground mb-6">
        This is the company Cavro AI will audit against AI assistants.
      </p>

      <div className="flex flex-col gap-4">
        <div>
          <Label>Company name <span className="text-rose-500">*</span></Label>
          <Input
            value={form.company}
            onChange={(v) => update({ company: v })}
            placeholder="Acme Inc."
          />
        </div>

        <div>
          <Label>Website URL <span className="text-rose-500">*</span></Label>
          <Input
            value={form.url}
            onChange={(v) => update({ url: v })}
            placeholder="acme.com"
            type="url"
          />
        </div>

        <div>
          <Label>Product category</Label>
          <Select
            value={form.category}
            onChange={(v) => update({ category: v })}
            options={CATEGORIES}
            placeholder="Select a category…"
          />
        </div>

        <div>
          <Label>Short product description</Label>
          <Textarea
            value={form.description}
            onChange={(v) => update({ description: v })}
            placeholder="Describe what your product does, who it's for, and what makes it different. The more specific, the better the audit."
            rows={4}
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground/40">
            This becomes the baseline Cavro AI audits against. Be specific.
          </p>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={onNext}
          disabled={!valid}
          className="btn-cavro-primary rounded-md px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — Competitors
// ---------------------------------------------------------------------------

function Step2({
  form,
  update,
  onBack,
  onNext,
}: {
  form: FormData
  update: (patch: Partial<FormData>) => void
  onBack: () => void
  onNext: () => void
}) {
  const valid = form.competitors.some((c) => c.trim() !== "")

  function setCompetitor(index: number, value: string) {
    const next = [...form.competitors]
    next[index] = value
    update({ competitors: next })
  }

  function addCompetitor() {
    if (form.competitors.length >= 5) return
    update({ competitors: [...form.competitors, ""] })
  }

  function removeCompetitor(index: number) {
    const next = form.competitors.filter((_, i) => i !== index)
    update({ competitors: next.length === 0 ? [""] : next })
  }

  return (
    <div>
      <StepIndicator current={2} />
      <h2 className="text-[16px] font-semibold text-foreground tracking-[-0.015em] mb-1">
        Who are your competitors?
      </h2>
      <p className="text-[12px] text-muted-foreground mb-6">
        Cavro AI will compare how AI assistants position you against each one. Add up to 5.
      </p>

      <div className="flex flex-col gap-2.5">
        {form.competitors.map((url, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-foreground/[0.05]">
              <span className="text-[10px] font-semibold text-foreground/40">{i + 1}</span>
            </div>
            <div className="flex-1">
              <Input
                value={url}
                onChange={(v) => setCompetitor(i, v)}
                placeholder={`competitor${i + 1}.com`}
              />
            </div>
            {form.competitors.length > 1 && (
              <button
                onClick={() => removeCompetitor(i)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      {form.competitors.length < 5 && (
        <button
          onClick={addCompetitor}
          className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <Plus size={13} />
          Add another competitor
        </button>
      )}

      <div className="mt-8 flex justify-between">
        <button
          onClick={onBack}
          className="btn-cavro-secondary rounded-md border px-4 text-[13px] font-medium text-foreground/70"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!valid}
          className="btn-cavro-primary rounded-md px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3 — Target prompts
// ---------------------------------------------------------------------------

function Step3({
  form,
  update,
  onBack,
  onNext,
}: {
  form: FormData
  update: (patch: Partial<FormData>) => void
  onBack: () => void
  onNext: () => void
}) {
  const valid = form.prompts.some((p) => p.trim() !== "")

  function setPrompt(index: number, value: string) {
    const next = [...form.prompts]
    next[index] = value
    update({ prompts: next })
  }

  function addPrompt() {
    if (form.prompts.length >= 10) return
    update({ prompts: [...form.prompts, ""] })
  }

  function removePrompt(index: number) {
    const next = form.prompts.filter((_, i) => i !== index)
    update({ prompts: next.length === 0 ? [""] : next })
  }

  function useExample(example: string) {
    // Fill the first empty slot, or append if all are filled
    const emptyIdx = form.prompts.findIndex((p) => p.trim() === "")
    if (emptyIdx !== -1) {
      setPrompt(emptyIdx, example)
    } else if (form.prompts.length < 10) {
      update({ prompts: [...form.prompts, example] })
    }
  }

  return (
    <div>
      <StepIndicator current={3} />
      <h2 className="text-[16px] font-semibold text-foreground tracking-[-0.015em] mb-1">
        What are your target buyer prompts?
      </h2>
      <p className="text-[12px] text-muted-foreground mb-6">
        These are the questions your buyers ask AI assistants when looking for a tool like yours. Add up to 10.
      </p>

      <div className="flex flex-col gap-2.5">
        {form.prompts.map((prompt, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-foreground/[0.05]">
              <span className="text-[10px] font-semibold text-foreground/40">{i + 1}</span>
            </div>
            <div className="flex-1">
              <Input
                value={prompt}
                onChange={(v) => setPrompt(i, v)}
                placeholder='e.g. "Best CRM for early-stage SaaS teams"'
              />
            </div>
            {form.prompts.length > 1 && (
              <button
                onClick={() => removePrompt(i)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      {form.prompts.length < 10 && (
        <button
          onClick={addPrompt}
          className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <Plus size={13} />
          Add another prompt
        </button>
      )}

      {/* Example prompts */}
      <div className="mt-5 rounded-md border border-dashed border-border px-4 py-3.5">
        <p className="text-[11px] font-semibold text-muted-foreground/40 uppercase tracking-widest mb-2.5">
          Example prompts — click to use
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PROMPT_EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => useExample(ex)}
              className="rounded bg-foreground/[0.04] px-2 py-1 text-[11px] text-foreground/50 hover:bg-foreground/[0.08] hover:text-foreground transition-colors text-left"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 flex justify-between">
        <button
          onClick={onBack}
          className="btn-cavro-secondary rounded-md border px-4 text-[13px] font-medium text-foreground/70"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={!valid}
          className="btn-cavro-primary rounded-md px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4 — Review
// ---------------------------------------------------------------------------

function Step4({
  form,
  onBack,
  onGenerate,
}: {
  form: FormData
  onBack: () => void
  onGenerate: () => void
}) {
  const cleanCompetitors = form.competitors.filter((c) => c.trim() !== "")
  const cleanPrompts     = form.prompts.filter((p) => p.trim() !== "")

  return (
    <div>
      <StepIndicator current={4} />
      <h2 className="text-[16px] font-semibold text-foreground tracking-[-0.015em] mb-1">
        Review your audit
      </h2>
      <p className="text-[12px] text-muted-foreground mb-6">
        Confirm the details below then generate your AI Recommendation Audit.
      </p>

      <div className="flex flex-col gap-0 divide-y divide-border rounded-md border border-border overflow-hidden">

        {/* Company */}
        <div className="px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1.5">
            Company
          </p>
          <p className="text-[13px] font-semibold text-foreground">{form.company}</p>
          <p className="text-[12px] text-muted-foreground/55">{form.url}</p>
          {form.category && (
            <span className="mt-1.5 inline-block rounded bg-foreground/[0.04] px-1.5 py-px text-[10px] font-medium text-foreground/50">
              {form.category}
            </span>
          )}
          {form.description && (
            <p className="mt-2 text-[12px] leading-relaxed text-foreground/50 line-clamp-2">
              {form.description}
            </p>
          )}
        </div>

        {/* Competitors */}
        <div className="px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1.5">
            Competitors ({cleanCompetitors.length})
          </p>
          {cleanCompetitors.length === 0 ? (
            <p className="text-[12px] text-muted-foreground/40">None added</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {cleanCompetitors.map((c) => (
                <span
                  key={c}
                  className="rounded bg-foreground/[0.04] px-2 py-px text-[11px] font-medium text-foreground/60"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Prompts */}
        <div className="px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1.5">
            Target prompts ({cleanPrompts.length})
          </p>
          {cleanPrompts.length === 0 ? (
            <p className="text-[12px] text-muted-foreground/40">None added</p>
          ) : (
            <div className="flex flex-col gap-1">
              {cleanPrompts.map((p, i) => (
                <p key={i} className="text-[12px] text-foreground/65">
                  {i + 1}. {p}
                </p>
              ))}
            </div>
          )}
        </div>

      </div>

      <div className="mt-8 flex justify-between">
        <button
          onClick={onBack}
          className="btn-cavro-secondary rounded-md border px-4 text-[13px] font-medium text-foreground/70"
        >
          ← Back
        </button>
        <button
          onClick={onGenerate}
          className="btn-cavro-primary rounded-md px-5 text-[13px] font-semibold text-primary-foreground"
        >
          Generate Audit
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

function LoadingState({ checkedItems }: { checkedItems: boolean[] }) {
  return (
    <div className="flex flex-col items-center py-8">
      {/* Spinner */}
      <div className="relative mb-8">
        <div className="h-12 w-12 rounded-full border-2 border-border" />
        <div className="absolute inset-0 h-12 w-12 animate-spin rounded-full border-2 border-transparent border-t-foreground" />
      </div>

      <h2 className="text-[15px] font-semibold text-foreground tracking-[-0.015em] mb-1 text-center">
        Analyzing your AI recommendation profile…
      </h2>
      <p className="text-[12px] text-muted-foreground text-center mb-8">
        This usually takes a few seconds
      </p>

      {/* Checklist */}
      <div className="w-full max-w-xs flex flex-col gap-2.5">
        {LOADING_STEPS.map((label, i) => {
          const checked = checkedItems[i] ?? false
          return (
            <div
              key={label}
              className={[
                "flex items-center gap-3 transition-opacity duration-300",
                checked ? "opacity-100" : "opacity-25",
              ].join(" ")}
            >
              <div
                className={[
                  "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                  checked
                    ? "border-foreground bg-foreground"
                    : "border-border bg-transparent",
                ].join(" ")}
              >
                {checked && <Check size={9} strokeWidth={3} className="text-background" />}
              </div>
              <span className="text-[13px] text-foreground/70">{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const INITIAL_FORM: FormData = {
  company:     "",
  url:         "",
  category:    "",
  description: "",
  competitors: ["", "", ""],
  prompts:     ["", "", ""],
}

export default function NewAuditPage() {
  const router = useRouter()

  const [step, setStep]               = useState<Step>(1)
  const [form, setForm]               = useState<FormData>(INITIAL_FORM)
  const [checkedItems, setCheckedItems] = useState<boolean[]>(
    new Array(LOADING_STEPS.length).fill(false),
  )

  // Store the generated audit in a ref so the loading effect can read it
  // without needing it as a dependency (avoids re-triggering on form changes).
  const auditRef = useRef<AuditResult | null>(null)

  function update(patch: Partial<FormData>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  function handleGenerate() {
    const cleanInput = {
      ...form,
      competitors: form.competitors.filter((c) => c.trim() !== ""),
      prompts:     form.prompts.filter((p) => p.trim() !== ""),
    }
    auditRef.current = generateMockAudit(cleanInput)
    setStep("loading")
  }

  // Run the loading animation when step === "loading"
  useEffect(() => {
    if (step !== "loading") return

    const audit = auditRef.current
    if (!audit) return

    const timers: ReturnType<typeof setTimeout>[] = []

    // Reveal each checklist item sequentially
    LOADING_STEPS.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setCheckedItems((prev) => {
            const next = [...prev]
            next[i] = true
            return next
          })
        }, (i + 1) * 900),
      )
    })

    // After all items, save and navigate
    timers.push(
      setTimeout(() => {
        try {
          localStorage.setItem(`cavro_audit_${audit.id}`, JSON.stringify(audit))
        } catch {
          // localStorage unavailable — continue anyway
        }
        router.push(`/audits/${audit.id}`)
      }, LOADING_STEPS.length * 900 + 800),
    )

    return () => timers.forEach(clearTimeout)
  }, [step, router])

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-lg">

        {/* Page header (hidden during loading) */}
        {step !== "loading" && (
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">
              New audit
            </p>
            <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-foreground">
              AI Recommendation Audit
            </h1>
          </div>
        )}

        {/* Form card */}
        <div className="card-cavro rounded-md px-6 py-6">
          {step === 1 && (
            <Step1
              form={form}
              update={update}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <Step2
              form={form}
              update={update}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <Step3
              form={form}
              update={update}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          )}
          {step === 4 && (
            <Step4
              form={form}
              onBack={() => setStep(3)}
              onGenerate={handleGenerate}
            />
          )}
          {step === "loading" && (
            <LoadingState checkedItems={checkedItems} />
          )}
        </div>

      </div>
    </div>
  )
}
