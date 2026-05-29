/**
 * GET /api/audits/[id]
 *
 * Fetches a single audit result by ID.
 *
 * CURRENT STATE: returns a 501 Not Implemented response.
 * The frontend (audits/[id]/page.tsx) currently uses hardcoded mock data and
 * does not yet call this route. This endpoint is ready for Johan to wire up.
 *
 * TODO (Johan):
 *  1. Read the audit row from Supabase by ID
 *  2. Verify the requesting user has access to this org's audit
 *  3. Return the full AuditResult shape (see lib/audit-mock.ts for the
 *     data shape the frontend already understands)
 *
 * URL param:  id — the audit ID string
 * Response:   { data: AuditResult } | { error: string }
 */

import { NextResponse } from "next/server"
import type { ApiResponse } from "@/types"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params

  if (!id) {
    return NextResponse.json<ApiResponse<never>>(
      { error: "Audit ID is required" },
      { status: 400 }
    )
  }

  // TODO (Johan): replace with real Supabase query
  // const client = createServiceClient()
  // const { data, error } = await client.from("audits").select("*").eq("id", id).single()
  // if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  // return NextResponse.json({ data })

  return NextResponse.json<ApiResponse<never>>(
    { error: "Audit persistence not yet implemented. See TODO in this file." },
    { status: 501 }
  )
}
