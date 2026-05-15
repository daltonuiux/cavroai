"use client"

import { useState } from "react"

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const PROMPTS = [
  { id: "p-1", text: "What is the best knowledge base tool for a remote team?", position: 3, score: 58, trend: "up"     as const, models: 4 },
  { id: "p-2", text: "Notion alternatives that are more affordable",            position: 1, score: 83, trend: "up"     as const, models: 6 },
  { id: "p-3", text: "No-code database tool with views and automations",        position: 5, score: 32, trend: "down"   as const, models: 1 },
  { id: "p-4", text: "Best tool for internal team wikis",                       position: 3, score: 55, trend: "stable" as const, models: 3 },
  { id: "p-5", text: "How do I build a knowledge base without engineering?",    position: 2, score: 68, trend: "up"     as const, models: 5 },
  { id: "p-6", text: "Best project management for a 20-person startup",        position: 6, score: 28, trend: "down"   as const, models: 2 },
  { id: "p-7", text: "What software do product teams use for docs?",           position: 4, score: 44, trend: "stable" as const, models: 3 },
]

const AUDITS = [
  { id: "audit-003", date: "May 6, 2026",  label: "Full audit",           score: 61, change: +7   },
  { id: "audit-002", date: "Apr 22, 2026", label: "Prompt coverage run",  score: 54, change: +5   },
  { id: "audit-001", date: "Apr 8, 2026",  label: "Baseline audit",       score: 49, change: null },
]

const COMPETITORS = [
  { id: "c-1", name: "Notion",   domain: "notion.so",    score: 79, wins: 4, ties: 1, losses: 2, edge: "Stronger brand recognition in knowledge-management prompts" },
  { id: "c-2", name: "Airtable", domain: "airtable.com", score: 65, wins: 2, ties: 1, losses: 4, edge: "Dominates no-code database prompts through indexed content volume" },
  { id: "c-3", name: "Coda",     domain: "coda.io",      score: 58, wins: 1, ties: 3, losses: 3, edge: "Strong in document-automation use-case prompts" },
  { id: "c-4", name: "Linear",   domain: "linear.app",   score: 74, wins: 3, ties: 2, losses: 2, edge: "Changelog cadence creates consistent AI-indexed proof of momentum" },
]
const YOUR_SCORE = 61

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number) {
  if (score >= 75) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 50) return "text-amber-600 dark:text-amber-400"
  return "text-rose-600 dark:text-rose-400"
}

function ScoreBar({ value, max = 100, compareValue }: { value: number; max?: number; compareValue?: number }) {
  return (
    <div className="relative w-24 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
      {compareValue !== undefined && (
        <div
          className="absolute top-0 h-full rounded-full bg-zinc-400/40 dark:bg-zinc-600/40"
          style={{ width: `${(compareValue / max) * 100}%` }}
        />
      )}
      <div
        className={`absolute top-0 h-full rounded-full ${value >= 75 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
        style={{ width: `${(value / max) * 100}%` }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Prompts tab
// ---------------------------------------------------------------------------

function PromptsTab() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Tracked prompts</p>
      <div
        className="rounded-xl border border-border overflow-hidden"
        style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.04)" }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-zinc-50/60 dark:bg-zinc-900/40">
              <th className="text-left text-[9px] font-bold uppercase tracking-widest text-zinc-400 px-4 py-2.5">Prompt</th>
              <th className="text-left text-[9px] font-bold uppercase tracking-widest text-zinc-400 px-3 py-2.5 w-20">Position</th>
              <th className="text-left text-[9px] font-bold uppercase tracking-widest text-zinc-400 px-3 py-2.5 w-24">Coverage</th>
              <th className="text-left text-[9px] font-bold uppercase tracking-widest text-zinc-400 px-3 py-2.5 w-28">Score</th>
            </tr>
          </thead>
          <tbody>
            {PROMPTS.map((p, i) => {
              const trendIcon = p.trend === "up" ? "↑" : p.trend === "down" ? "↓" : "→"
              const trendClass =
                p.trend === "up"
                  ? "text-emerald-500"
                  : p.trend === "down"
                  ? "text-rose-500"
                  : "text-zinc-400"

              return (
                <tr
                  key={p.id}
                  className={`hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40 transition-colors duration-150 ${i < PROMPTS.length - 1 ? "border-b border-border" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <span className="text-[12px] text-foreground leading-snug">{p.text}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {p.position === 1 ? (
                      <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums bg-emerald-500/[0.09] text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
                        #1
                      </span>
                    ) : (
                      <span className={`text-[12px] tabular-nums font-medium ${p.score < 40 ? "text-rose-500" : "text-foreground"}`}>
                        #{p.position}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-[10px] text-zinc-400 tabular-nums">{p.models}/7 models</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${p.score >= 75 ? "bg-emerald-500" : p.score >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                          style={{ width: `${p.score}%` }}
                        />
                      </div>
                      <span className={`text-[12px] tabular-nums font-medium ${scoreColor(p.score)}`}>
                        {p.score}
                      </span>
                      <span className={`text-[11px] ${trendClass}`}>{trendIcon}</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Audits tab
// ---------------------------------------------------------------------------

function AuditsTab() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Audit history</p>
      <div
        className="rounded-xl border border-border overflow-hidden"
        style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.04)" }}
      >
        {AUDITS.map((a, i) => {
          const isLatest = i === 0
          return (
            <div
              key={a.id}
              className={`flex items-center justify-between px-4 py-3.5 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40 transition-colors duration-150 ${i < AUDITS.length - 1 ? "border-b border-border" : ""}`}
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-foreground">{a.label}</span>
                  {isLatest && (
                    <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-zinc-500/[0.09] text-zinc-600 dark:text-zinc-300 ring-1 ring-inset ring-zinc-500/20">
                      Latest
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-zinc-400">{a.date}</span>
              </div>
              <div className="flex items-center gap-3">
                {a.change !== null && (
                  <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums bg-emerald-500/[0.09] text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
                    +{a.change}
                  </span>
                )}
                <span className={`text-[22px] font-semibold tabular-nums leading-none ${scoreColor(a.score)}`}>
                  {a.score}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Competitors tab
// ---------------------------------------------------------------------------

function CompetitorsTab() {
  const sorted = [...COMPETITORS].sort((a, b) => b.score - a.score)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Competitor landscape</p>
        <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 tabular-nums">
          Your score: {YOUR_SCORE}
        </span>
      </div>
      <div
        className="rounded-xl border border-border overflow-hidden"
        style={{ boxShadow: "0 1px 4px 0 rgb(0 0 0 / 0.04)" }}
      >
        {sorted.map((c, i) => (
          <div
            key={c.id}
            className={`flex items-center gap-4 px-4 py-3.5 hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40 transition-colors duration-150 ${i < sorted.length - 1 ? "border-b border-border" : ""}`}
          >
            {/* Name + domain */}
            <div className="flex flex-col gap-0.5 w-28 shrink-0">
              <span className="text-[13px] font-medium text-foreground">{c.name}</span>
              <span className="text-[10px] text-zinc-400">{c.domain}</span>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center w-10 shrink-0">
              <span className={`text-[18px] font-semibold tabular-nums leading-none ${scoreColor(c.score)}`}>
                {c.score}
              </span>
            </div>

            {/* Score bar vs yours */}
            <div className="flex flex-col gap-1 w-28 shrink-0">
              <ScoreBar value={c.score} compareValue={YOUR_SCORE} />
              <span className="text-[9px] text-zinc-400">vs your {YOUR_SCORE}</span>
            </div>

            {/* Win/loss record */}
            <div className="flex items-center gap-1 text-[11px] tabular-nums shrink-0">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{c.wins}W</span>
              <span className="text-zinc-400">{c.ties}T</span>
              <span className="text-rose-600 dark:text-rose-400 font-medium">{c.losses}L</span>
            </div>

            {/* Edge */}
            <span className="text-[11px] text-zinc-400 min-w-0 flex-1">{c.edge}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function ResearchClient({
  initialTab = "prompts",
}: {
  initialTab?: "prompts" | "audits" | "competitors"
}) {
  const [tab, setTab] = useState<"prompts" | "audits" | "competitors">(initialTab)

  const tabs = [
    { key: "prompts",     label: "Prompts"     },
    { key: "audits",      label: "Audits"      },
    { key: "competitors", label: "Competitors" },
  ] as const

  return (
    <div className="flex flex-col w-full gap-6">
      {/* Tab bar */}
      <div className="pb-px border-b border-border">
        <div className="flex items-center gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`pb-2 text-[13px] transition-colors duration-150 ${
                tab === t.key
                  ? "font-semibold text-foreground border-b-2 border-foreground -mb-px"
                  : "text-zinc-500 hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {tab === "prompts"     && <PromptsTab />}
      {tab === "audits"      && <AuditsTab />}
      {tab === "competitors" && <CompetitorsTab />}
    </div>
  )
}
