<!-- SEED — re-run $impeccable document once the redesign has code, to capture the actual tokens and components. -->
---
name: co/core chat
description: A distributed, ChatGPT-style chat for everyday people, warm and effortless.
---

# Design System: co/core chat

## 1. Overview

**Creative North Star: "Daybreak"**

Daybreak is the moment a pale-blue sky meets the first warm coral light: calm,
optimistic, and human. The interface should feel like that, an easy, friendly
place to talk, where every new chat is a fresh and unintimidating start. This is
a distributed ChatGPT for regular people, so the conversation is the whole
product and everything else gets quiet. Warmth and a little playfulness live in
the details (a soft empty state, a satisfying send, a touch of character in
copy), never in noise.

It is a full palette held with discipline: two lights, a cool pale blue and a
warm coral, over warm tinted neutrals. The blue carries trust and primary
action; the coral carries warmth, identity, and delight. The type is a single
rounded sans so the surface reads soft and approachable rather than technical.
Motion is responsive, not theatrical: things respond when you act, and step
aside when the user prefers reduced motion.

This system explicitly rejects the look it is replacing and its neighbors: no
developer console (no wall-to-wall monospace, terminal motifs, or exposed model
strings), no crypto or web3 neon-on-black, no enterprise SaaS template (hero
metrics, identical icon-card grids), and no cluttered power-tool where settings
and parameters crowd the message thread.

**Key Characteristics:**
- Conversation-first: chrome earns its space or disappears.
- Two-light palette: pale blue (cool, primary) and coral (warm, delight) over warm neutrals.
- Soft and rounded: friendly type and gently curved shapes, never sharp or technical.
- Quiet whole, delightful details: calm overall so small moments land.
- Light-leaning and warm; honest, plain-spoken, a touch playful.

## 2. Colors

A full palette of two deliberate hues, pale blue and coral, resting on warm
tinted neutrals. Each hue owns a role; neither competes for the same job.

### Primary
- **Daybreak Blue** (pale, soft blue; exact value `[to be resolved during implementation]`): Primary actions, the send affordance, links, selected and focused states. Calm and trustworthy, never icy or neon.

### Secondary
- **Warm Coral** (soft coral / peach; `[to be resolved during implementation]`): Warmth and personality. Identity touches (the user being greeted by name), highlights, and small delight moments. Used sparingly so it stays special.

### Neutral
- **Warm Paper** (off-white tinted toward the palette, never `#fff`; `[to be resolved]`): The primary reading surface for long conversations.
- **Soft Ink** (near-black tinted warm, never `#000`; `[to be resolved]`): Body text and headings, at AA contrast or better on Warm Paper.
- **Muted Stone** (low-chroma mid neutral; `[to be resolved]`): Secondary text, borders, dividers, the user message bubble.

### Named Rules
**The Two-Light Rule.** Only two hues are allowed to carry meaning: Daybreak
Blue and Warm Coral. No third accent ever intrudes, specifically no green
(the old console color), no neon, no violet. Everything else is a warm neutral.

**The Coral-Is-Rare Rule.** Coral marks warmth and personality, not routine
chrome. If coral covers more than a small fraction of a screen, it has stopped
being special.

## 3. Typography

**Display Font:** Rounded humanist sans `[family to be chosen at implementation; candidates: Hanken Grotesk, Figtree, Nunito]`
**Body Font:** Same family as display (single-family system)
**Label/Mono Font:** A mono is used only inside rendered code blocks, never for UI chrome `[family to be chosen at implementation]`

**Character:** Soft, friendly, and highly legible. One rounded sans does the
whole UI so the surface feels approachable, not technical. Hierarchy comes from
scale and weight, not from switching families.

### Hierarchy
- **Display** (bold, large; `[scale to be resolved]`): Rare. The empty-state greeting ("What can I help with?" / a name greeting).
- **Headline** (semibold; `[scale]`): Section moments, settings titles.
- **Title** (semibold/medium; `[scale]`): Conversation titles in history, dialog headers.
- **Body** (regular; `[scale]`, line-height ~1.6): The conversation itself and rendered markdown prose. Cap measure at 65-75ch for assistant text.
- **Label** (medium; small; minimal letter-spacing): Controls, captions, metadata. Avoid all-caps shouting.

### Named Rules
**The One-Family Rule.** A single rounded sans carries all UI text. Monospace
appears only inside rendered code, never in labels, buttons, or model names.

**The Weight-Not-Family Rule.** Build hierarchy with size and weight (contrast
ratio at least 1.25 between steps), never by introducing a second display face.

## 4. Elevation

Flat and warm by default. Depth is conveyed with tonal layering (a slightly
different warm neutral for raised surfaces) and a single soft, diffuse shadow
that appears only as a response to state, such as the composer on focus, a
hovered history item, or an open dialog. No hard drop shadows, no decorative
glass.

### Named Rules
**The Flat-At-Rest Rule.** Surfaces are flat until the user interacts. Shadows
are feedback, not decoration. If a shadow is visible with no interaction, it is
too strong.

**No Glass Rule.** Backdrop blur and glassmorphism are prohibited as default
surface treatment. Warm tonal layers do the work instead.

## 5. Components

`[Deferred to implementation.]` The current components reflect the developer-y
look being replaced, so this seed does not document them. Re-run
`$impeccable document` after the redesign to capture the real button, composer,
message bubble, history item, dialog, and settings primitives, and to generate
the `DESIGN.json` sidecar. Until then, synthesize primitives from the palette
and rules above: soft-cornered shapes, Daybreak Blue primary actions, flat-at-rest
surfaces, rounded-sans text.

## 6. Do's and Don'ts

### Do:
- **Do** keep the conversation the focus; let settings, parameters, and network stats recede behind it.
- **Do** anchor on the two lights only: Daybreak Blue for primary action, Warm Coral for warmth and delight, warm neutrals for everything else.
- **Do** tint every neutral toward the palette; reading surfaces are Warm Paper, text is Soft Ink (never `#fff`, never `#000`).
- **Do** use one rounded humanist sans for all UI; reserve monospace for rendered code blocks only.
- **Do** render markdown properly: headings, inline code, code blocks, lists, and emphasis, not raw text.
- **Do** keep motion responsive and honor `prefers-reduced-motion`; ease out, no bounce.
- **Do** be plainspoken and lightly playful in copy; greet people by name when personalization is on, and be honest that history is per-browser only.
- **Do** invite running a node gently and in context, never as a gate or a nag.

### Don't:
- **Don't** look like a developer tool or console: no wall-to-wall monospace, terminal motifs, or exposed model strings in the main UI.
- **Don't** reach for crypto / web3 neon: no neon-on-black, no glowing gradients, no token-launch energy.
- **Don't** ship enterprise SaaS clichés: no hero-metric blocks, no identical icon-card grids.
- **Don't** crowd the thread with knobs; tuck parameters and settings away until wanted.
- **Don't** introduce a third accent hue, especially the old green, neon, or violet.
- **Don't** use gradient text (`background-clip: text`), side-stripe borders (`border-left` accents over 1px), or glassmorphism as decoration.
- **Don't** use em dashes in UI copy.
