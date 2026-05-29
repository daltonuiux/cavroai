/**
 * Supabase database types — PLACEHOLDER.
 *
 * TODO (Johan): replace this file with generated types once the schema is ready.
 *
 * Run:
 *   npx supabase gen types typescript --project-id <your-project-id> > lib/supabase/database.types.ts
 *
 * Or, if using the local CLI:
 *   npx supabase gen types typescript --local > lib/supabase/database.types.ts
 *
 * Until then, this placeholder prevents TypeScript import errors.
 * Do not invent actual table/column shapes here.
 */

export type Database = {
  public: {
    Tables:    Record<string, never>
    Views:     Record<string, never>
    Functions: Record<string, never>
    Enums:     Record<string, never>
  }
}
