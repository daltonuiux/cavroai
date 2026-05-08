# Cavro UI Skill

## Product intent

Cavro AI is an AI recommendation optimization tool for SaaS companies.

It helps founders understand how AI assistants may interpret, compare, and recommend their company.

The app should feel focused, premium, operational, and calm.

It is not a generic SaaS dashboard.
It is not an SEO report reader.
It is not an enterprise analytics suite.

It is a decision interface for improving AI recommendation readiness.

---

# Core principles

1. Show the most useful action first.
2. Hide depth until requested.
3. Never make the user read a wall of text to understand what to do.
4. Every screen should answer:

   * what matters
   * why it matters
   * what to do next
5. Prefer useful density over decorative whitespace.
6. Prioritize recommendation fixes over passive metrics.
7. Reduce repetition aggressively.
8. Use width like a product UI, not like a marketing site.
9. Make every insight actionable.
10. Avoid dashboard filler.

---

# Product language

Use these terms:

* AI recommendation
* recommendation readiness
* AI perception
* positioning gap
* competitor risk
* prompt readiness
* trust signal
* suggested fix
* next action
* audit

Avoid these terms unless required:

* GEO
* AEO
* LLMO
* robust
* leverage
* strategic alignment
* enterprise visibility
* infrastructure
* dashboard analytics

---

# Layout

1. Use a wide working canvas.
2. Avoid overly narrow centered layouts.
3. Primary app screens should feel like tools, not landing pages.
4. Default to two-column layouts when comparing insights and actions.
5. Keep readable paragraph width around 60–70ch.
6. Large empty areas are a design failure unless they improve focus.
7. Use spacing to signal hierarchy, not decoration.
8. Overview is a command center.
9. Audits are the core workflow.
10. Recommendations are the action layer.

---

# Screen hierarchy

Every screen should follow this order:

1. Current state
2. Biggest issue
3. Best next action
4. Supporting detail

Do not lead with tables unless the table is the clearest way to act.

---

# Overview screen

The Overview screen is a command center.

It should answer this in under 10 seconds:

* How ready are we to be recommended by AI?
* What is holding us back?
* What should we do next?

Recommended structure:

1. Top summary

   * AI Recommendation Score
   * Status
   * one-sentence AI perception summary
   * last audit date
   * Run new audit button

2. Top recommendation risks

   * maximum 3 items
   * short explanation
   * suggested action

3. Quick wins

   * highest-impact fixes
   * concise checklist format

4. Prompt readiness

   * compact list or table
   * no oversized cards

5. Recent audits

   * minimal table or list

Rules:

1. No oversized padding.
2. No decorative dead space.
3. No repeated insights.
4. No giant report sections.
5. Make the next action obvious.

---

# Audits screen

Audits are the main product workflow.

The screen should help users:

1. Run a new audit.
2. Review recent audits.
3. Compare score changes over time.
4. Open a detailed audit result.

Rules:

1. Put “Run new audit” near the top.
2. Keep audit cards compact.
3. Show score, status, date, and key finding.
4. Avoid long summaries.
5. Make audit history easy to scan.

---

# Audit creation flow

The audit flow should feel fast and guided.

Recommended steps:

1. Company
2. Competitors
3. Target prompts
4. Review

Rules:

1. Start with the minimum required inputs.
2. Use helper examples.
3. Do not expose long forms upfront.
4. Show progress clearly.
5. Keep each step focused.
6. Loading states should explain what is happening.

Loading checklist examples:

* Reviewing positioning clarity
* Comparing competitor messaging
* Mapping prompt relevance
* Checking trust signals
* Preparing recommendations

---

# Audit result screen

The audit result screen is a decision screen, not a report.

It should answer:

* How does AI understand us?
* Why might AI not recommend us?
* Which competitors are stronger?
* What should we fix first?

Recommended structure:

1. Executive summary

   * score
   * status
   * one-sentence summary
   * primary next action

2. AI perception

   * plain English description
   * short and specific

3. Why AI may not recommend you yet

   * 3–5 issue cards
   * each with a clear fix

4. Competitor comparison

   * compact table
   * avoid chart-heavy layouts

5. Prompt readiness

   * prompt
   * readiness score
   * weakness
   * suggested improvement

6. Recommended fixes

   * priority
   * problem
   * why it matters
   * suggested action
   * example copy

7. Website copy rewrites

   * before and after
   * homepage headline
   * subheadline
   * category description
   * proof block

8. Next actions

   * 3 prioritized steps

Rules:

1. Do not create a wall of text.
2. Keep sections compact.
3. Put the strongest recommendation early.
4. Hide secondary detail when possible.
5. Make example copy easy to copy.

---

# Competitors screen

The Competitors screen should show where competitors are stronger in AI recommendation contexts.

It should answer:

* Who is more likely to be recommended?
* Why are they stronger?
* Which prompts do they win?
* What can we copy or counter?

Rules:

1. Keep comparison tables compact.
2. Highlight gaps, not vanity metrics.
3. Use short labels.
4. Avoid noisy charts.
5. Make competitor risks actionable.

---

# Prompts screen

Prompts represent buyer questions users want AI to answer.

The screen should help users:

1. Track target prompts.
2. See readiness by prompt.
3. Understand weaknesses.
4. Improve prompt-level positioning.

Rules:

1. Show prompt text clearly.
2. Show readiness or position compactly.
3. Group similar prompts if needed.
4. Avoid long prompt cards.
5. Make it easy to add prompts.

---

# Recommendations screen

Recommendations are the action layer.

The screen should help users:

1. See what to fix.
2. Understand why it matters.
3. Copy suggested improvements.
4. Track progress.

Rules:

1. Prioritize by impact.
2. Use status labels:

   * pending
   * in progress
   * done
3. Keep before and after copy tight.
4. Avoid repeating audit content.
5. One recommendation should equal one clear action.

---

# Settings screen

Settings should be simple.

Recommended fields:

* Company name
* Website URL
* Product category
* AI assistants to consider
* Audit frequency

Rules:

1. Keep settings minimal.
2. Avoid technical configuration.
3. Use plain labels.
4. Do not add integrations until needed.

---

# Radius system

1. Use a consistent Tailwind or shadcn radius scale.
2. Do not mix arbitrary radius values.
3. Maintain consistency across all components.

---

# Color system

1. Use the Tailwind Zinc palette for all UI colors.
2. Default backgrounds should use zinc-50 or white.
3. Primary text should use zinc-900.
4. Secondary text should use zinc-500.
5. Borders should use zinc-200 or rgba(24, 24, 27, 0.12).
6. Avoid custom colors unless required.
7. Do not use bright or saturated colors for primary UI.
8. Accent colors should be minimal and used only for status.

Status color guidance:

* Success: muted green
* Warning: muted amber
* Error: muted red
* Neutral: zinc

---

# Typography

1. Use strong page titles with muted supporting text.
2. Section labels should be small, uppercase, and quiet.
3. Main decision text should be short, bold, and easy to scan.
4. Avoid long paragraphs.
5. Break complex thinking into tight blocks.
6. Use plain English.
7. No em dashes anywhere.
8. Prefer short sentences and direct phrasing.

---

# Writing style

1. Short sentences.
2. Direct language.
3. No em dashes.
4. No consultant jargon.
5. No SEO jargon unless needed.
6. Every block should explain, rank, or instruct.
7. Replace “this suggests” with “this means” where possible.
8. Avoid buzzwords like leverage, enable, optimize, robust, strategic alignment.
9. Use “fix” instead of “recommendation” when it improves clarity.
10. Use “AI may not recommend you because…” when explaining issues.

---

# Buttons and Cards

This design system uses only two surface styles:

1. Neutral surface style

   * used for cards
   * secondary buttons
   * inputs
   * tables
   * dropdowns

2. Primary action style

   * used only for primary CTA buttons

Do not introduce additional surface systems.

---

# Neutral surface style

Use this exact styling for:

* cards
* secondary buttons
* inputs
* selects
* dropdown triggers
* table containers

```css
border-radius: 8px;
border: 1px solid rgba(24, 24, 27, 0.12);
background: #FFF;
box-shadow: 0 1px 1px 0 rgba(0, 0, 0, 0.04);
```

Rules:

1. Do not use inset shadows.
2. Do not use Tailwind shadow utilities.
3. Do not add additional blur or elevation.
4. Do not create alternate card styles.
5. Keep surfaces subtle and operational.
6. Secondary buttons should visually match cards and inputs.

---

# Secondary buttons

Use the neutral surface style exactly.

Additional styling:

```css
padding: 8px 12px;
font-size: 14px;
font-weight: 500;
color: #18181B;
```

Interaction states:

```css
hover background: #FAFAFA;
hover border-color: rgba(24, 24, 27, 0.18);

active background: #F4F4F5;

disabled opacity: 0.5;
```

Rules:

1. Secondary buttons must feel flat and neutral.
2. Never use gradients on secondary buttons.
3. Never use heavy shadows.
4. Keep hover states subtle.
5. Use secondary buttons for low-priority actions only.

---

# Primary buttons

Use this exact styling:

```css
border-radius: 8px;
border: 1px solid #18181B;
background: linear-gradient(180deg, #52525C 0%, #3F3F46 50%, #27272A 100%);
box-shadow: 0 1px 1px 0 rgba(2, 39, 61, 0.08), 0 1px 0.5px 0 rgba(255, 255, 255, 0.24) inset;
padding: 8px 12px;
font-size: 14px;
font-weight: 500;
color: #FFFFFF;
```

Interaction states:

```css
hover background: linear-gradient(180deg, #5B5B66 0%, #484852 50%, #303036 100%);

active background: linear-gradient(180deg, #3F3F46 0%, #2F2F35 100%);
```

Rules:

1. Primary actions use depth and gradient to signal importance.
2. Only one primary action per section when possible.
3. Never make primary buttons flat.
4. Never introduce alternate gradient styles.
5. Primary buttons should feel dense, premium, and operational.
6. Do not add glow effects.
7. Do not add extra shadows.

---

# Inputs

Inputs should match the card and secondary button system.

Recommended styling:

```css
border-radius: 8px;
border: 1px solid rgba(24, 24, 27, 0.12);
background: #FFF;
box-shadow: 0 1px 1px 0 rgba(0, 0, 0, 0.04);
```

Rules:

1. Keep input labels short.
2. Use helper text only when useful.
3. Avoid large form blocks.
4. Group related inputs clearly.
5. Show examples for prompts and competitors.

---

# Tables

Tables should be compact and readable.

Rules:

1. Use tables for comparison and history.
2. Keep columns minimal.
3. Avoid dense analytics tables.
4. Use muted headers.
5. Keep row height compact.
6. Make primary text easy to scan.
7. Use right-aligned numeric values when useful.

---

# Badges

Badges should be quiet.

Rules:

1. Use badges for status, priority, and category.
2. Keep labels short.
3. Avoid bright colors.
4. Use muted zinc backgrounds by default.
5. Use muted status colors only when needed.

Example labels:

* Weak
* Developing
* Strong
* High
* Medium
* Low
* Pending
* In progress
* Done

---

# Empty states

Empty states should drive action.

Rules:

1. Explain what is missing.
2. Show why it matters.
3. Provide one primary action.
4. Keep copy short.
5. Avoid illustration-heavy empty states.

---

# Loading states

Loading states should explain progress.

Rules:

1. Show what is being checked.
2. Use checklist-style progress.
3. Keep loading text short.
4. Avoid fake technical language.
5. Do not use decorative animation.

---

# Motion

1. Motion should be subtle and under 300ms.
2. Use ease-out for entrances.
3. Use ease-in-out for in-place changes.
4. No decorative animation.
5. Motion should clarify hierarchy and response, not impress.

---

# Shadow system

Use only these shadows.

### Cards, inputs, and secondary buttons

```css
box-shadow: 0 1px 1px 0 rgba(0, 0, 0, 0.04);
```

### Primary buttons

```css
box-shadow: 0 1px 1px 0 rgba(2, 39, 61, 0.08), 0 1px 0.5px 0 rgba(255, 255, 255, 0.24) inset;
```

Rules:

1. Do not use Tailwind shadow utilities.
2. Do not use inset shadows on cards.
3. Do not use inset shadows on inputs.
4. Do not use inset shadows on secondary buttons.
5. Do not introduce new shadow styles.
6. Do not modify opacity, blur, or spread.

---

# Avoid

* giant empty gutters
* repeated text
* over-explaining
* enterprise buzzwords
* SEO jargon everywhere
* dashboard filler cards
* secondary actions that distract from the main move
* heavy shadows
* decorative gradients outside primary buttons
* giant paragraphs
* em dashes
* generic analytics layouts
* huge charts before clear actions
