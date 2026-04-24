export type Priority = "High" | "Medium" | "Low"

export type SignalType = "hiring" | "messaging" | "product" | "blog" | "funding"

export type OpportunityType = "warm" | "high_intent"

export type Confidence = "high" | "medium"

export type PathStrength = "High" | "Medium" | "Low"
export type PathType = "current_client" | "past_client" | "overlap" | "none"

export interface IntroPath {
  via: string | null        // name of the connecting client / contact
  type: PathType
  strength: PathStrength
  summary: string           // one-line punchy summary of the path value
  whyItWorks: string        // 1–2 sentences on why this path is credible
  whyNow: string            // 1–2 sentences on timing and urgency
  steps: string[]           // 2–3 verb-first actionable steps
  introRequest: string      // message to send to your contact asking for intro
}

export interface OpportunityLead {
  id: string
  company: string
  websiteUrl: string
  signal: string
  signalType: SignalType
  type: OpportunityType
  priority: Priority
  confidence: Confidence
  score: number
  headline: string
  warmReason?: string
  signals: string[]
  whatsHappening: string
  whatToDo: string
  outreach: string
  introPath: IntroPath
}

// Each lead requires 2-3 converging signals before it's included.
// Single-signal observations are excluded regardless of signal strength.
const MOCK_LEADS: OpportunityLead[] = [
  {
    id: "lead-vercel",
    company: "Vercel",
    websiteUrl: "https://vercel.com",
    signal: "Messaging shift + enterprise hiring + client overlap",
    signalType: "messaging",
    type: "warm",
    priority: "High",
    confidence: "high",
    score: 98,
    headline: "Vercel is mid-enterprise push and you have a direct path via Linear",
    warmReason:
      "You already work with Linear, and Linear runs on Vercel. That gives you a credible warm entry into their team that cold outbound doesn't have.",
    signals: [
      "Linear (your client) uses Vercel",
      "Homepage shifted to enterprise messaging in the last 60 days",
      "3 enterprise sales roles posted in the last 45 days",
    ],
    whatsHappening:
      "They rewrote their homepage to target enterprise buyers and started hiring enterprise salespeople. The story is ahead of the process underneath it. That gap is widest right now.",
    whatToDo:
      "Reach out to the Head of Sales or CRO. Mention the homepage shift directly and ask how their enterprise process is working today. Don't pitch immediately.",
    outreach:
      "Hi [Name], the homepage shift toward enterprise is hard to miss. That kind of change usually means the story is a few months ahead of the process underneath it. We work with teams closing that gap, and Linear is already a customer. Worth a quick conversation?",
    introPath: {
      via: "Linear",
      type: "current_client",
      strength: "High",
      summary: "Direct path via active client. Linear runs on Vercel.",
      whyItWorks:
        "Linear is an active client and uses Vercel in production. Your contact knows their team and can make a credible intro.",
      whyNow:
        "Vercel rewrote their homepage for enterprise buyers 60 days ago and posted 3 enterprise sales roles. The gap between their story and their process is widest right now.",
      steps: [
        "Ask your Linear contact who owns the Vercel relationship on their side.",
        "Request a short email intro to someone in Vercel's GTM or sales ops team.",
        "Open with the enterprise rollout question. Do not pitch on the first call.",
      ],
      introRequest:
        "Hey [Name], I'm planning to reach out to the Vercel team. I know Linear uses them in production so figured you might have a contact there. Would you be up for a short email intro? Happy to keep it totally low-key on my end.",
    },
  },
  {
    id: "lead-loom",
    company: "Loom",
    websiteUrl: "https://loom.com",
    signal: "Series C funding + 3 simultaneous product launches + client overlap",
    signalType: "funding",
    type: "warm",
    priority: "High",
    confidence: "high",
    score: 94,
    headline: "Loom just raised $30M and your Notion relationship is the warm path in",
    warmReason:
      "Notion is your client and deploys Loom across their team. You have account context and a specific reason to reach out that cold outbound doesn't have.",
    signals: [
      "Notion (your client) uses Loom across their team",
      "Raised $30M Series C",
      "Three new products launched in the same quarter",
    ],
    whatsHappening:
      "Funding plus three simultaneous launches means they're in a deliberate sprint, not steady growth. New tools get bought in these windows before processes harden.",
    whatToDo:
      "Target the VP of Product or CTO. They're running three launches at once and stretched thin. Open with the coordination problem across simultaneous launches, not a product pitch.",
    outreach:
      "Hi [Name], three product launches off the back of a Series C is a lot to coordinate. We work with teams at exactly this stage when output starts outrunning the learning. Notion is already a customer in a similar setup. Happy to show you what that looks like in 15 minutes.",
    introPath: {
      via: "Notion",
      type: "current_client",
      strength: "High",
      summary: "Active client uses Loom company-wide. You have a direct bridge.",
      whyItWorks:
        "Notion uses Loom across their team and you have an active relationship with them. That gives you a credible, specific reason to ask for an intro.",
      whyNow:
        "Loom raised $30M and launched three products this quarter. Teams in this kind of sprint buy new tools before their processes harden. That window is open now.",
      steps: [
        "Ask your Notion contact who they work with at Loom.",
        "Get a name or short email intro to someone on Loom's product or ops team.",
        "Lead with the multi-launch coordination problem. Do not open with a pitch.",
      ],
      introRequest:
        "Hey [Name], quick ask. I'm looking to connect with someone at Loom and I know your team uses them a lot. Would you be up for a short email intro? I'll keep it easy on their end.",
    },
  },
  {
    id: "lead-retool",
    company: "Retool",
    websiteUrl: "https://retool.com",
    signal: "Enterprise content push + enterprise hiring + Stripe reference customer",
    signalType: "blog",
    type: "warm",
    priority: "High",
    confidence: "high",
    score: 91,
    headline: "Retool is building an enterprise tier and Stripe gives you the warm path in",
    warmReason:
      "Stripe is your client and is listed as a reference customer on Retool's website. You have a specific, credible reason to reach out that cold outbound doesn't have.",
    signals: [
      "Stripe (your client) is a Retool reference customer",
      "6 enterprise compliance posts published in 60 days (SOC 2, HIPAA, procurement layer)",
      "Enterprise AE and CS roles posted in the last 30 days",
    ],
    whatsHappening:
      "The compliance content and enterprise hiring point to the same thing: a new enterprise tier that's close to launching. Content like this is planned months in advance. The sales hires are following the content.",
    whatToDo:
      "Target the Head of Product Marketing or VP of Product. Reference the compliance posts by name. Ask when the enterprise tier launches. Frame yourself as something that closes a gap they're already publicly acknowledging.",
    outreach:
      "Hi [Name], your last six posts have all been on enterprise compliance: SOC 2, HIPAA, the procurement layer. Stripe has been a customer of ours for a while and the overlap is obvious. That kind of content focus usually means a new tier isn't far off. Worth a conversation?",
    introPath: {
      via: "Stripe",
      type: "current_client",
      strength: "High",
      summary: "Stripe is publicly listed as a Retool reference customer.",
      whyItWorks:
        "Stripe's logo and story are on Retool's website. Your contact can make a credible intro grounded in a documented relationship.",
      whyNow:
        "Six enterprise compliance posts in 60 days plus new AE hires point to a tier launch. Content like this leads product launches by 60 to 90 days. The window is open now.",
      steps: [
        "Ask your Stripe contact who owns the Retool relationship on their side.",
        "Request an intro to someone on Retool's product or enterprise sales team.",
        "Lead with the compliance content angle when you connect.",
      ],
      introRequest:
        "Hey [Name], I saw Stripe is listed as a reference customer on Retool's site and wanted to reach out to their product or enterprise team. Would you be up for a short email intro? I'll make it easy for them.",
    },
  },
  {
    id: "lead-rippling",
    company: "Rippling",
    websiteUrl: "https://rippling.com",
    signal: "Enterprise hiring surge + messaging shift + new enterprise pricing tier",
    signalType: "hiring",
    type: "high_intent",
    priority: "High",
    confidence: "high",
    score: 82,
    headline: "Rippling is hiring enterprise AEs fast and the tooling window is open now",
    warmReason:
      "There is no incumbent to displace yet. The new reps will set their tools in their first few weeks and those decisions tend to stick.",
    signals: [
      "4 enterprise AE roles posted in 30 days",
      "Homepage now leads with compliance and procurement language",
      "Enterprise pricing tier added in the last 60 days",
    ],
    whatsHappening:
      "Hiring, messaging, and pricing all shifted at once. That's a coordinated upmarket push. The enterprise AEs being hired right now will shape their toolstack in the first few weeks on the job.",
    whatToDo:
      "Find the VP of Sales or Head of Enablement. Reference the hiring volume specifically. Ask what the onboarding process looks like for the new enterprise reps. Every week they are not productive is real money.",
    outreach:
      "Hi [Name], noticed Rippling posted four enterprise sales roles this month. We work with sales teams at exactly this stage, when new headcount is ramping fast and the tooling needs to keep up. Worth 20 minutes to see if it's relevant?",
    introPath: {
      via: null,
      type: "none",
      strength: "Low",
      summary: "No warm path found. Go direct with a specific hook.",
      whyItWorks:
        "Four enterprise AE roles in 30 days is a hard signal. Tooling decisions for new reps aren't locked in yet.",
      whyNow:
        "New enterprise reps set their toolstack in the first few weeks. Once they're onboarded and running, those choices stick.",
      steps: [
        "Find the VP of Sales or Head of Enablement on LinkedIn.",
        "Lead with the hiring volume. It shows you've been watching.",
        "Ask about onboarding for the new enterprise reps, not about your product.",
      ],
      introRequest: "",
    },
  },
  {
    id: "lead-hex",
    company: "Hex",
    websiteUrl: "https://hex.tech",
    signal: "First enterprise hire + pricing restructure + content shift toward enterprise use cases",
    signalType: "hiring",
    type: "high_intent",
    priority: "Medium",
    confidence: "medium",
    score: 63,
    headline: "Hex just posted their first enterprise sales hire and nothing is locked in yet",
    warmReason:
      "This is the earliest window you'll have. The incoming sales leader will shape the toolstack in their first 30 days and there is no incumbent to displace.",
    signals: [
      "First enterprise sales leader role posted",
      "Pricing page restructured to separate team vs enterprise tiers",
      "Blog content shifted toward enterprise analytics use cases",
    ],
    whatsHappening:
      "Hex is making a deliberate move upmarket and they're early. No established tools, no hardened process, no incumbent. That changes quickly once the new hire starts.",
    whatToDo:
      "Target the incoming enterprise sales leader before they start, or the CEO who made the hire. They're thinking hardest right now about what the new person will need.",
    outreach:
      "Hi [Name], congrats on the new role at Hex. Stepping into a first-time enterprise motion is exciting but the setup decisions you make early tend to stick. We work with sales leaders in this exact moment. Would love to share what we've seen work. Open to a call in your first few weeks?",
    introPath: {
      via: null,
      type: "none",
      strength: "Low",
      summary: "No warm path found. Timing is the edge here.",
      whyItWorks:
        "No tools are locked in. The incoming sales leader will make these decisions in their first 30 days and there is no incumbent to displace.",
      whyNow:
        "The enterprise sales leader role just posted. Once they start, the window for shaping their setup narrows fast. Reach out now or immediately after their start date.",
      steps: [
        "Find the incoming sales leader on LinkedIn before they start.",
        "Reach out to the CEO or hiring manager while the role is still being filled.",
        "Move in the next two weeks. Timing is the entire advantage here.",
      ],
      introRequest: "",
    },
  },
  {
    id: "lead-coda",
    company: "Coda",
    websiteUrl: "https://coda.io",
    signal: "AI product launch + enterprise sales hiring + new enterprise pricing plan",
    signalType: "product",
    type: "high_intent",
    priority: "Medium",
    confidence: "medium",
    score: 59,
    headline: "Coda's AI launch created a messaging gap their reps haven't solved yet",
    warmReason:
      "Every rep is explaining the new product differently right now. If enablement or messaging work is in your scope, this is exactly that engagement.",
    signals: [
      "AI product launch changed their target buyer",
      "2 enterprise sales and enablement roles posted since launch",
      "Enterprise pricing plan added post-launch",
    ],
    whatsHappening:
      "The sales team is now pitching a new product to a new buyer without a settled story. That inconsistency window typically lasts 60 to 90 days and it's open right now.",
    whatToDo:
      "Target the VP of Sales or Head of Enablement. Ask how many different ways the new product is being described in discovery calls. Be specific about the inconsistency problem.",
    outreach:
      "Hi [Name], the AI launch looks great. The tricky part usually comes 60 days in when every rep has a slightly different version of the story. We help sales teams tighten that up after a big product change. Worth a quick call?",
    introPath: {
      via: null,
      type: "none",
      strength: "Low",
      summary: "No warm path found. Use the launch as the hook.",
      whyItWorks:
        "Every rep is explaining the new product differently right now. That's a specific, observable problem that hasn't been fixed yet.",
      whyNow:
        "The messaging inconsistency window after a big product launch is 60 to 90 days. They're inside that window now.",
      steps: [
        "Find the Head of Enablement or VP of Sales on LinkedIn.",
        "Lead with the post-launch messaging problem. Be specific about the inconsistency.",
        "Reference the AI launch and new pricing tier in your first line.",
      ],
      introRequest: "",
    },
  },
]

export function generateOpportunities(): OpportunityLead[] {
  return [...MOCK_LEADS].sort((a, b) => b.score - a.score)
}

export function getOpportunityById(id: string): OpportunityLead | undefined {
  return MOCK_LEADS.find((l) => l.id === id)
}
