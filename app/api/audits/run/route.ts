/**
 * POST /api/audits/run
 *
 * Triggers a new AI visibility audit for a given brand.
 *
 * CURRENT STATE: returns a mock response generated from lib/audit-mock.ts.
 * The frontend (audits/new/page.tsx) currently runs the mock generator
 * client-side and does not yet call this route. This endpoint is ready for
 * Johan to wire up the real backend.
 *
 * TODO (Johan):
 *  1. Validate the request body
 *  2. Write the audit job to Supabase (status: "pending")
 *  3. Trigger real AI queries (ChatGPT, Claude, Perplexity, Gemini)
 *  4. Compute the real visibility score
 *  5. Write results back to Supabase (status: "complete")
 *  6. Return the audit ID so the frontend can poll or redirect
 *
 * Request body: RunAuditRequest (see types/index.ts)
 * Response:     { data: { id: string; isMock: boolean } } | { error: string }
 */

import { NextResponse } from "next/server"
import { generateMockAudit } from "@/lib/audit-mock"
import type { RunAuditRequest, ApiResponse } from "@/types"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RunAuditRequest

    // -- Input validation (minimal) ------------------------------------------
    if (!body.company || !body.url) {
      return NextResponse.json<ApiResponse<never>>(
        { error: "company and url are required" },
        { status: 422 }
      )
    }

    // -- TODO: replace with real AI queries + Supabase write -----------------
    const audit = generateMockAudit({
      company:     body.company,
      url:         body.url,
      category:    body.category     ?? "",
      description: body.description  ?? "",
      competitors: body.competitors  ?? [],
      prompts:     body.prompts      ?? [],
    })

    return NextResponse.json<ApiResponse<{ id: string; isMock: boolean }>>({
      data: { id: audit.id, isMock: true },
    })
  } catch {
    return NextResponse.json<ApiResponse<never>>(
      { error: "Failed to run audit" },
      { status: 500 }
    )
  }
}
