/**
 * Cross-linking: Events ↔ Surfaces
 *
 * Connects RadarEvent[] and Surface[] by the people they share.
 * Runs after both buildEventRadar() and buildSurfaces() have produced their
 * output — it has no DB access and no side effects beyond populating the
 * relatedEvents / relatedSurfaces arrays on each object in place.
 *
 * Relationship is symmetric: if a surface contains person A and event X also
 * lists person A as an attendee, both get a reference to the other.
 */

import type { Surface, EventRef }   from "./surfaces"
import type { RadarEvent, SurfaceRef } from "./events-radar"

/**
 * Populates `surface.relatedEvents` and `event.relatedSurfaces` for every
 * (surface, event) pair that shares at least one person (matched by email).
 *
 * Sorting:
 *   - Primary: sharedPeopleCount desc (most overlap first)
 *   - Secondary: score / strength desc (higher quality first)
 *
 * Pure mutation — no return value. Call once per page render after both
 * buildSurfaces() and buildEventRadar() have run.
 */
export function linkEventsToSurfaces(
  surfaces: Surface[],
  events:   RadarEvent[],
): void {
  // ── Surface → Events ────────────────────────────────────────────────────────
  for (const surface of surfaces) {
    const surfaceEmails = new Set(surface.people.map((p) => p.email))
    const refs: EventRef[] = []

    for (const event of events) {
      const sharedCount = event.people.filter((p) => surfaceEmails.has(p.email)).length
      if (sharedCount === 0) continue

      refs.push({
        id:               event.id,
        name:             event.name,
        score:            event.score,
        estimatedDate:    event.estimatedDate,
        location:         event.location,
        sharedPeopleCount: sharedCount,
      })
    }

    surface.relatedEvents = refs.sort(
      (a, b) => b.sharedPeopleCount - a.sharedPeopleCount || b.score - a.score,
    )
  }

  // ── Event → Surfaces ─────────────────────────────────────────────────────────
  for (const event of events) {
    const eventEmails = new Set(event.people.map((p) => p.email))
    const refs: SurfaceRef[] = []

    for (const surface of surfaces) {
      const sharedCount = surface.people.filter((p) => eventEmails.has(p.email)).length
      if (sharedCount === 0) continue

      refs.push({
        id:               surface.id,
        title:            surface.title,
        strength:         surface.strength,
        sharedPeopleCount: sharedCount,
      })
    }

    event.relatedSurfaces = refs.sort(
      (a, b) => b.sharedPeopleCount - a.sharedPeopleCount || b.strength - a.strength,
    )
  }
}
