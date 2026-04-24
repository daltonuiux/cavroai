export const dynamic = "force-dynamic"

import { getClients } from "@/lib/db"
import { Globe } from "lucide-react"
import Link from "next/link"
import { AddClientModal } from "@/components/add-client-modal"

export default async function ClientsPage() {
  const clients = await getClients()

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-foreground">
            Clients
          </h1>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {clients.length === 0
              ? "Add your first client to start an analysis"
              : `${clients.length} client${clients.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <AddClientModal />
      </div>

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-20 text-center">
          <Globe className="mb-3 size-8 text-muted-foreground/40" strokeWidth={1.5} />
          <p className="text-[13px] font-medium text-foreground">No clients yet</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Start with 5–10 clients you know well.
          </p>
          <div className="mt-4">
            <AddClientModal />
          </div>
        </div>
      ) : (
        <div className="card-cavro flex flex-col divide-y divide-border overflow-hidden rounded-md">
          {clients.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-muted/40"
              >
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{client.name}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{client.websiteUrl}</p>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(client.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </Link>
            ))}
        </div>
      )}
    </div>
  )
}
