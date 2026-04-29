/**
 * Shared contact-quality filter.
 *
 * Used by:
 *   - lib/google-sync.ts  — during initial sync (prevents bad contacts entering DB)
 *   - app/api/intelligence/rebuild/route.ts — retrospective cleanse of existing DB rows
 *
 * Keeping this in one place ensures the sync pipeline and the rebuild endpoint
 * always agree on what constitutes a "real contact".
 */

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

export function domainFromEmail(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? ""
}

// ---------------------------------------------------------------------------
// Exclusion sets
// ---------------------------------------------------------------------------

/** Free/personal email providers — not useful for B2B contact mapping. */
export const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk",
  "hotmail.com", "hotmail.co.uk", "outlook.com", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "aol.co.uk",
  "protonmail.com", "proton.me", "pm.me",
  "zoho.com", "yandex.com", "mail.com",
])

/**
 * Domains that emit only automated/platform notifications — not real contacts.
 * Individual company contacts (e.g. john@stripe.com) are kept;
 * this list targets pure notification-routing infrastructure.
 */
export const NOTIFICATION_DOMAINS = new Set([
  // Social / professional networks
  "linkedin.com", "bounce.linkedin.com", "email.linkedin.com",
  "twitter.com", "x.com", "t.co",
  "facebook.com", "facebookmail.com",
  "instagram.com",
  "pinterest.com",
  "tiktok.com",
  // Design platforms
  "dribbble.com",
  "behance.net",
  // Dev / infra platforms
  "github.com",
  "gitlab.com",
  "vercel.com",
  // Google notification routing
  "google.com",
  "googlegroups.com",
  "notifications.google.com",
  "mail-noreply.google.com",
  "calendar.google.com",
  // Publishing / newsletter platforms
  "medium.com",
  "substack.com",
  "beehiiv.com",
  "convertkit.com",
  "kit.com",
  // Email marketing / transactional infra
  "mailchimp.com", "list-manage.com",
  "sendgrid.net", "sendgrid.com",
  "mailgun.org",
  "amazonses.com",
  "sparkpostmail.com",
  "klaviyo.com",
  "mandrillapp.com",
  "mailerlite.com",
  "constantcontact.com",
  // Survey / form tools
  "surveymonkey.com",
  "typeform.com",
])

/**
 * Local-part patterns that identify automated/transactional senders.
 * Tested against the part of the email address before the @.
 */
export const NO_REPLY_RE = /^(no[._-]?reply|do[._-]?not[._-]?reply|dont[._-]?reply|donotreply|notifications?|newsletters?|mailer(-daemon)?|bounce[sd]?|auto[._-]?mailer|autoresponder|alerts?|digest|campaigns?|updates|postmaster|hostmaster|webmaster|unsubscribe|opt[._-]?out|feedback[._-]?noreply|support[._-]?noreply|hello|hi|info|news|marketing|automated|system|daemon|noti|calendar[._-]?notification|calendar-server|google[._-]?alerts?|invitations?)$/i

// ---------------------------------------------------------------------------
// Filter predicate
// ---------------------------------------------------------------------------

/**
 * Returns true if this email address should be excluded from the contact graph.
 *
 * Rejects:
 *   - Emails with no recognisable domain
 *   - Free/personal email providers (gmail, yahoo, etc.)
 *   - Notification-only platform domains
 *   - The user's own domain (internal addresses)
 *   - Automated sender patterns (noreply, newsletter, mailer-daemon, etc.)
 */
export function shouldSkipContact(email: string, userDomain: string): boolean {
  const domain    = domainFromEmail(email)
  if (!domain || !domain.includes(".")) return true
  if (FREE_EMAIL_DOMAINS.has(domain))   return true
  if (NOTIFICATION_DOMAINS.has(domain)) return true
  if (domain === userDomain)            return true
  const localPart = email.split("@")[0] ?? ""
  if (NO_REPLY_RE.test(localPart))      return true
  return false
}
