import { NextResponse } from "next/server"
import { createClient as createDbClient, markProspectAdded, MVP_USER_ID } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  let body: { prospectId?: string; name?: string; websiteUrl?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { prospectId, name, websiteUrl } = body

  if (!prospectId || typeof prospectId !== "string") {
    return NextResponse.json({ error: "prospectId is required" }, { status: 400 })
  }
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  if (!websiteUrl || typeof websiteUrl !== "string" || !websiteUrl.startsWith("http")) {
    return NextResponse.json({ error: "A valid websiteUrl (starting with http) is required" }, { status: 400 })
  }

  // Resolve user id — fall back to MVP sentinel when no auth session exists
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  try {
    // Create the client record
    const client = await createDbClient({
      name: name.trim(),
      websiteUrl: websiteUrl.trim(),
    })

    // Link the prospect → client, scoped to the resolved user
    await markProspectAdded(prospectId, client.id, userId)

    return NextResponse.json({ clientId: client.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add prospect"
    console.error("add-prospect error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
