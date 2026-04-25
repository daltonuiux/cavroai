"use server"

import { revalidatePath } from "next/cache"
import { upsertAgencyProfile } from "@/lib/db"

function str(formData: FormData, key: string): string | undefined {
  const v = (formData.get(key) as string ?? "").trim()
  return v || undefined
}

function arr(formData: FormData, key: string): string[] {
  return (formData.get(key) as string ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function num(formData: FormData, key: string): number | undefined {
  const v = (formData.get(key) as string ?? "").trim()
  const n = parseInt(v, 10)
  return isNaN(n) || n <= 0 ? undefined : n
}

export async function saveAgencyProfile(formData: FormData) {
  await upsertAgencyProfile({
    agencyName: str(formData, "agencyName") ?? "",
    website: str(formData, "website"),
    positioning: str(formData, "positioning"),
    services: arr(formData, "services"),
    idealClientTypes: arr(formData, "idealClientTypes"),
    industries: arr(formData, "industries"),
    minBudget: num(formData, "minBudget"),
    maxBudget: num(formData, "maxBudget"),
    geography: str(formData, "geography"),
    proofPoints: arr(formData, "proofPoints"),
    badFitClients: arr(formData, "badFitClients"),
  })

  revalidatePath("/profile")
  revalidatePath("/opportunities")
}
