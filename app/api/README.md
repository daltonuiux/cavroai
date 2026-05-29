# API Routes

> **Status:** Placeholder routes only. Current responses are mock/stub until Johan wires the real backend.

The frontend currently uses client-side mock generation (`lib/audit-mock.ts`) and does not call these routes yet. These files establish the contract so frontend and backend can develop in parallel.

---

## Implemented (placeholder)

### `POST /api/audits/run`

Triggers a new AI visibility audit.

**Request body** (`RunAuditRequest` — see `types/index.ts`):
```json
{
  "company":     "Acme Inc.",
  "url":         "acme.com",
  "category":    "Knowledge management",
  "description": "A wiki tool for engineering teams",
  "competitors": ["notion.so", "confluence.atlassian.com"],
  "prompts":     ["Best async wiki for engineering teams"]
}
```

**Response (current — mock):**
```json
{ "data": { "id": "abc123", "isMock": true } }
```

**Response (target — real):**
```json
{ "data": { "id": "abc123", "isMock": false } }
```

**TODO (Johan):** validate input → write pending job to Supabase → run real AI queries → write results → return ID.

---

### `GET /api/audits/[id]`

Fetches a completed audit result by ID.

**Response (current):** `501 Not Implemented`

**Response (target — real):**
```json
{
  "data": {
    "id": "abc123",
    "createdAt": "2026-05-29T...",
    "company": "Acme Inc.",
    "score": 61,
    "executiveSummary": "...",
    "aiPerception": { ... },
    "recommendationBarriers": [ ... ],
    "competitorComparison": [ ... ],
    "promptReadiness": [ ... ],
    "recommendedFixes": [ ... ],
    "copyRewrites": [ ... ],
    "nextActions": [ ... ]
  }
}
```

See `lib/audit-mock.ts` → `AuditResult` type for the full data shape the frontend already understands.

**TODO (Johan):** Supabase query by ID + org access check.

---

## Planned (not yet created)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/brand-profile` | Fetch brand profile for logged-in org |
| `PUT` | `/api/brand-profile` | Update brand profile |
| `GET` | `/api/visibility-score` | Current score + trend history |
| `GET` | `/api/competitors` | Competitor list for org |
| `POST` | `/api/competitors` | Add a competitor |
| `GET` | `/api/recommendations` | AI-generated recommendations for org |
| `POST` | `/api/recommendations/[id]/complete` | Mark a recommendation done |
| `GET` | `/api/prompts` | Tracked prompts for org |
| `POST` | `/api/prompts` | Add a tracked prompt |
| `POST` | `/api/cron/refresh-visibility` | Scheduled refresh (check `CRON_SECRET` header) |

---

## Conventions

All routes should return the `ApiResponse<T>` shape from `types/index.ts`:

```ts
// Success
{ "data": { ... } }

// Error
{ "error": "Human-readable message" }
```

Use `lib/supabase/server.ts` → `createServiceClient()` for server-side Supabase access.

Secure `/api/cron/*` routes by checking:
```ts
if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```
