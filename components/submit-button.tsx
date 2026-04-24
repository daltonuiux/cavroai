"use client"

import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"

export function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-cavro-primary border flex items-center justify-center gap-2 rounded-md px-4 text-[13px] font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <>
          <Loader2 className="size-[13px] animate-spin" />
          Saving…
        </>
      ) : (
        "Add Client & Analyze"
      )}
    </button>
  )
}
