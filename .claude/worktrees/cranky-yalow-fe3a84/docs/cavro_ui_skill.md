# Cavro UI Skill

## Product intent
Cavro AI is a relationship intelligence tool for agencies and consultants.
It should feel focused, premium, operational, and calm.
It is not a generic SaaS dashboard.
It is not a report reader.
It is a decision interface.

## Core principles
1. Show the most useful action first.
2. Hide depth until requested.
3. Never make the user read a wall of text to understand what to do.
4. Every screen should answer: what matters, why it matters, what should I do next.
5. Prefer density over air when the content is operational.
6. Prioritize warm opportunities and network-aware context over generic insights.
7. Reduce repetition aggressively.
8. Use width like a product UI, not like a marketing site.

## Layout
1. Use a wide working canvas. Avoid overly narrow centered layouts.
2. Primary app screens should feel like tools, not landing pages.
3. Default to two-column layouts when comparing a list and a selected detail.
4. Keep readable paragraph width around 60–70ch.
5. Large empty areas are a design failure unless they improve focus.
6. Use spacing to signal hierarchy, not decoration.
7. Overview is a command center. Opportunities is an execution list. Client detail is a decision screen.

## Radius system
1. Use a consistent Tailwind or shadcn radius scale
2. Default radius is 8px for buttons, inputs, and cards
3. Smaller elements may use 6px
4. Larger containers may use 10–12px if needed
5. Do not mix arbitrary radius values
6. Maintain consistency across all components

## Color system
1. Use Tailwind Zinc palette for all UI colors.
2. Default backgrounds should use zinc-50 or white.
3. Text should use zinc-900 for primary and zinc-500 or zinc-600 for secondary.
4. Borders should use zinc-200 or subtle rgba equivalents.
5. Avoid introducing custom colors unless absolutely necessary.
6. Do not use bright or saturated colors for primary UI.
7. Accent colors should be minimal and used only for status (success, warning, error).

## Typography
1. Strong page title, muted supporting text.
2. Section labels should be small, uppercase, and quiet.
3. Main decision text should be short, bold, and easy to scan.
4. Avoid long paragraphs. Break complex thinking into tight blocks.
5. Use plain English. No consultant language.
6. No em dashes anywhere.
7. Prefer short sentences and direct phrasing.

## Writing style
1. Short sentences.
2. Direct language.
3. No em dashes.
4. No consultant jargon.
5. Every block should either explain, rank, or instruct.
6. Replace phrases like “this suggests” with “this means” where possible.
7. Avoid buzzwords like leverage, enable, optimize, robust, strategic alignment.

## Cards
1. Cards should be compact and useful
2. Reduce internal padding where possible
3. Use cards to separate meaning, not decorate layout
4. Each card should answer one job clearly
5. Avoid repeating the same insight across sections
6. Keep borders subtle
7. Avoid heavy shadows

### Card styling
- Border radius: 8px
- Border: 1px solid rgba(24, 24, 27, 0.12)
- Background: #FFFFFF
- box-shadow: 0 1px 1px 0 rgba(0, 0, 0, 0.04);

### Card rules
1. Cards should feel slightly elevated but not floaty
2. Use subtle depth, not heavy drop shadows
3. Maintain consistency with secondary button styling
4. Avoid mixing multiple shadow styles across the UI
5. Cards should group related information clearly without adding noise

## Buttons
### Secondary buttons
- Border radius: 8px
- Border: 1px solid rgba(24, 24, 27, 0.12)
- Background: #FFFFFF
- box-shadow: 0 1px 1px 0 rgba(0, 0, 0, 0.04);
- Padding: 8px 12px
- Font size: 14px
- Font weight: 500
- Color: #18181B

### Secondary button interaction
- Hover background: #FAFAFA
- Hover border color: rgba(24, 24, 27, 0.18)
- Active background: #F4F4F5
- Active shadow: 0 1px 1px 0 rgba(0, 0, 0, 0.04) inset
- Disabled opacity: 0.5

### Primary buttons
- Border radius: 8px
- Border: 1px solid #18181B
- Background: linear-gradient(180deg, #52525C 0%, #3F3F46 50%, #27272A 100%)
- box-shadow: 0 1px 1px 0 rgba(2, 39, 61, 0.08), 0 1.5px 0.5px 0 rgba(255, 255, 255, 0.24) inset;
- Padding: 8px 12px
- Padding: 8px 12px
- Font size: 14px
- Font weight: 500
- Color: #FFFFFF

### Primary button interaction
- Hover background: linear-gradient(180deg, #5B5B66 0%, #484852 50%, #303036 100%)
- Active background: linear-gradient(180deg, #3F3F46 0%, #2F2F35 100%)
- Active shadow: 0 1px 1px 0 rgba(2, 39, 61, 0.08) inset

### Button rules
1. Primary actions use depth and gradient to signal importance.
2. Secondary actions remain flat and neutral.
3. Never use gradients on secondary buttons.
4. Never make primary buttons flat.
5. Only one primary action per section or screen when possible.

## Opportunities screen
1. Warm opportunities should feel privileged over generic ones.
2. The headline should be short, sharp, and outcome-driven.
3. “Why it’s warm” or “Your edge” should be the strongest section after the headline.
4. “Why this surfaced” should be brief and evidence-based.
5. Outreach should be easy to copy and immediately usable.
6. The top opportunity should feel obviously top-ranked.
7. Decision structure should be: headline, why it’s warm, what’s happening, what to do, outreach.
8. Do not show repetitive analysis blocks by default.

## Client detail screen
1. Users should understand what to do in under 5 seconds.
2. Show the primary action early.
3. Keep “why this matters,” “why now,” and “your advantage” short.
4. Hide full analysis behind expandable sections.
5. Avoid report-style layouts.

## Overview screen
1. The Overview screen is a command center.
2. It should answer what to focus on this week in under 10 seconds.
3. The top section should surface the three strongest opportunities.
4. Rankings, changes, and actions should be compact and scannable.
5. No oversized padding or decorative dead space.

## Client onboarding
1. All add-client paths happen inside a modal.
2. Start with the fastest option.
3. Make CSV and site detection feel like accelerators, not onboarding burden.
4. Never expose a long CRM-like form upfront.
5. Keep the first step minimal, then reveal richer options.

## Motion
1. Motion should be subtle and under 300ms.
2. Use ease-out for entrances, ease-in-out for in-place changes.
3. No decorative animation.
4. Motion should clarify hierarchy and response, not impress.

## Avoid
- giant empty gutters
- repeated text
- over-explaining
- enterprise buzzwords
- dashboard filler cards
- secondary actions that distract from the main move
- heavy shadows
- decorative gradients outside primary buttons
- giant paragraphs
- em dashes

## Shadow system

Do not use Tailwind default shadows (shadow-sm, shadow-md, etc).

Use these exact shadow values:

### Card shadow
box-shadow:
0 1px 2px 0 rgba(0, 0, 0, 0.06),
0 -1px 1px 0 rgba(24, 24, 27, 0.12) inset;

### Secondary button shadow
box-shadow:
0 -1px 1px 0 rgba(24, 24, 27, 0.12) inset,
0 1px 1px 0 rgba(0, 0, 0, 0.04);

### Primary button shadow
box-shadow:
0 1px 1px 0 rgba(2, 39, 61, 0.08),
0 1.5px 1px 0 rgba(255, 255, 255, 0.64) inset;

Rules:
1. Do not use Tailwind shadow utilities
2. Always use these exact values
3. Do not modify opacity, blur, or spread
4. Do not introduce new shadow styles
