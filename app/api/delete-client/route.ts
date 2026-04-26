import { NextResponse } from "next/server"
import { deleteClient } from "@/lib/db"

export async function DELETE(req: Request) {
  let body: { clientId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { clientId } = body
  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 })
  }

  console.log("DELETE CLIENT CLICKED:", clientId)

  try {
    await deleteClient(clientId)
    console.log("CLIENT DELETED:", clientId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed"
    console.error("delete-client error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
