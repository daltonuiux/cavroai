# Kaelor AI

**AI Visibility Platform** — understand how AI assistants perceive, describe, and recommend your company, and take action to improve it.

Kaelor AI helps B2B SaaS companies measure and improve their AI visibility score: how often they appear in ChatGPT, Claude, Perplexity, and Gemini responses when buyers ask about their product category.

---

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local and fill in your Supabase keys.
# AI provider keys (OpenAI, Anthropic, etc.) are only needed once
# the real query pipeline is wired — the app runs on mock data without them.

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Verify the build:**
```bash
npm run build        # production build
npx tsc --noEmit     # type check only
```

---

## Product surfaces

| Route | Description |
|---|---|
| `/overview` | Visibility score, trend, model-by-model read summary |
| `/perception` | How each AI model currently describes your brand, with before/after previews |
| `/recommendations` | Action center: prioritised fixes with signal-based reasoning and confidence scores |
| `/research` | Prompt tracking, audit history, competitor monitoring |
| `/audits/new` | Run a new brand visibility audit (mock-powered for now) |
| `/audits/[id]` | Full audit result: prompt performance, competitor comparison, AI model observations |

---

## Tech stack

- [Next.js 16](https://nextjs.org) — App Router, server components, async `searchParams`
- [Tailwind CSS](https://tailwindcss.com) — zinc palette
- [Supabase](https://supabase.com) — database and auth (schema TBD)
- [Geist](https://vercel.com/font) — sans + mono

---

## Collaboration

### Luke — frontend
- Page structure and product flows
- UI polish and component work
- Mock-data-driven interface (everything currently works without a real backend)
- When Johan ships an API endpoint, update the relevant page to call it instead of the mock

### Johan — backend
- Supabase schema design and migrations
- Authentication (Supabase Auth recommended)
- API route handlers in `app/api/` (see `app/api/README.md` for the full spec)
- Real AI query pipeline (visibility scoring across ChatGPT, Claude, Perplexity, Gemini)
- Persistence: audits, brand profiles, tracked prompts, competitors
- Billing and credits (later)

### Shared
- **API contracts and shared types live in `types/index.ts`** — both sides should agree before an endpoint is built
- Database types live in `lib/supabase/database.types.ts` — Johan generates these with `npx supabase gen types typescript` once the schema is set
- The `AuditResult` type in `lib/audit-mock.ts` is the current source of truth for audit data shape; it should match what the real API eventually returns

---

## Project structure

```
app/
  overview/            Visibility score dashboard
  perception/          AI brand perception narrative
  recommendations/     Action center
  research/            Prompts, audits, competitors
  audits/
    new/               New audit wizard (mock-powered)
    [id]/              Audit result detail (hardcoded mock data)
  api/
    audits/
      run/route.ts     POST — placeholder, returns mock ID
      [id]/route.ts    GET  — placeholder, returns 501
    README.md          Full API spec for Johan

components/
  sidebar.tsx          Left nav
  topbar.tsx           Top bar with route title
  model-icon.tsx       SVG icons: ChatGPT, Claude, Perplexity, Gemini

lib/
  audit-mock.ts        ⚠ MOCK — client-side audit generator, temporary
  supabase/
    client.ts          Browser Supabase client
    server.ts          Server Supabase client (cookie-aware + service role)
    database.types.ts  ⚠ PLACEHOLDER — Johan replaces with generated types

types/
  index.ts             Shared API contract types (Luke + Johan)
```

---

## Environment variables

See `.env.example` for the full list. The app runs locally without any env vars set (mock data only). Supabase keys are required to enable auth and persistence once that's built.

| Variable | Required for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Auth + database |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth + database |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase (API routes) |
| `OPENAI_API_KEY` | Real ChatGPT visibility queries |
| `ANTHROPIC_API_KEY` | Real Claude visibility queries |
| `PERPLEXITY_API_KEY` | Real Perplexity visibility queries |
| `GOOGLE_API_KEY` | Real Gemini visibility queries |
| `CRON_SECRET` | Securing scheduled job endpoints |
| `NEXT_PUBLIC_APP_URL` | Absolute URL for links and redirects |
