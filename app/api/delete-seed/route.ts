import { NextResponse } from "next/server"
import { deleteRelationshipSeed, MVP_USER_ID } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"

export async function DELETE(req: Request) {
  let body: { id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { id } = body
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? MVP_USER_ID

  try {
    await deleteRelationshipSeed(id, userId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete seed"
    console.error("delete-seed error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
