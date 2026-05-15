/**
 * Monochrome SVG icons for the four tracked AI platforms.
 * All paths use currentColor so they inherit the parent's text colour.
 * Sized at 20 × 20 px (w-5 h-5) by default via className.
 */

type ModelName = "ChatGPT" | "Claude" | "Perplexity" | "Gemini"

interface ModelIconProps {
  model:      string
  className?: string
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/** OpenAI / ChatGPT — the interlocking-hexagon bloom mark. */
function ChatGPTIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zm-9.022 12.61a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.678 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  )
}

/**
 * Anthropic / Claude — the compact radiating-lines mark.
 * Seven short bars fanned around an arc, mirroring Anthropic's logomark
 * as it renders at small sizes.
 */
function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128-4.72.04-.79-2.953 7.43.049.069-.069v-.618l-.069-.069-7.43-.029.79-2.982 4.72.04.08-.128-.08-.23-4.72-2.647 1.151-1.988 4.102 3.294.198-.04.159-.199-.676-5.163 2.858-.805.784 5.144.109.099h.238l.109-.099.784-5.144 2.858.805-.676 5.163.159.199.198.04 4.102-3.294 1.151 1.988-4.72 2.647-.08.23.08.128 4.72-.04.79 2.982-7.43.029-.069.069v.618l.069.069 7.43-.049-.79 2.953-4.72-.04-.08.128.08.23 4.72 2.647-1.151 1.988-4.102-3.294-.198.04-.159.199.676 5.163-2.858.805-.784-5.144-.109-.099h-.238l-.109.099-.784 5.144-2.858-.805.676-5.163-.159-.199-.198-.04-4.102 3.294-1.151-1.988z" />
    </svg>
  )
}

/**
 * Perplexity — the bold asterisk-star mark used in their product icon.
 */
function PerplexityIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M19.09 5.25h-5.91l4.1-3.64-.98-1.11-4.3 3.82V.25h-1.5v4.07L6.21.5l-.98 1.11 4.1 3.64H3.41v5.58h1.5v-1.3l5.34 4.82v1.88L4.6 18.9v-1.4H3.1v5.5h6.26v-4.64l3.14-2.83 3.14 2.83V23h6.26v-5.5h-1.5v1.4l-5.65-2.67v-1.88l5.34-4.82v1.3h1.5V5.25zm-14.18 1.5h14.18v2.43L12 14.36 5.09 9.18V6.75zM7.86 22l-.01-3.26 3.65 1.73L7.86 22zm8.28 0-3.64-1.53 3.65-1.73L16.14 22z" />
    </svg>
  )
}

/**
 * Google / Gemini — the four-pointed elongated sparkle.
 * The cubic-bezier curves reproduce the characteristic narrow-waisted points.
 */
function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 0C12 0 12.945 7.515 15.757 10.243 18.485 13.055 24 12 24 12 24 12 18.485 10.945 15.757 13.757 12.945 16.485 12 24 12 24 12 24 11.055 16.485 8.243 13.757 5.515 10.945 0 12 0 12 0 12 5.515 13.055 8.243 10.243 11.055 7.515 12 0Z" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Registry + export
// ---------------------------------------------------------------------------

const ICONS: Record<ModelName, (props: { className?: string }) => React.ReactElement> = {
  ChatGPT:    ChatGPTIcon,
  Claude:     ClaudeIcon,
  Perplexity: PerplexityIcon,
  Gemini:     GeminiIcon,
}

export function ModelIcon({ model, className = "w-5 h-5" }: ModelIconProps) {
  const Icon = ICONS[model as ModelName]
  if (!Icon) return null
  return <Icon className={className} />
}
