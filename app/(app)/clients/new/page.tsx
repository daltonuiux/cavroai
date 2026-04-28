import { addClientFromForm } from "@/app/actions"
import { SubmitButton } from "@/components/submit-button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function NewClientPage() {
  return (
    <div className="max-w-lg">
      <Link
        href="/clients"
        className="mb-6 flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3" strokeWidth={2} />
        Clients
      </Link>

      <h1 className="mb-1 text-[22px] font-semibold tracking-[-0.025em] text-foreground">
        Add Client
      </h1>
      <p className="mb-8 text-sm text-muted-foreground">
        We'll scrape the website and run an AI analysis automatically.
      </p>

      <form action={addClientFromForm} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="name"
            className="text-[12px] font-medium text-foreground"
          >
            Client name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="Acme Corp"
            className="h-8 rounded-md border border-border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="websiteUrl"
            className="text-[12px] font-medium text-foreground"
          >
            Website URL
          </label>
          <input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            required
            placeholder="https://acme.com"
            className="h-8 rounded-md border border-border bg-background px-3 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
          />
        </div>

        <SubmitButton />
      </form>
    </div>
  )
}
