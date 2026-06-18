# Product

## Register

product

## Users

Regular people, not developers. Someone signs in with a co/core API key (which
resolves to their AT Protocol / Bluesky identity) and wants to chat, the same
way they would open ChatGPT. They have little or no interest in the underlying
network, model ids, or routing. Their context is everyday: a quick question, a
bit of writing help, a thing to think through. Some small fraction also run a
provider node, but the interface should never assume that.

## Product Purpose

A distributed version of ChatGPT. Every reply is served by a stranger's
attested Mac on the co/core network instead of a central provider, but that is
an implementation detail the user should rarely have to think about. Success is
a non-technical person signing in and having a genuinely good chat within
seconds, then coming back because it feels personal and effortless.

What makes it more than a thin API wrapper:

- **Local chat history.** Conversations are saved in the browser so past
  sessions are there when you return. This is explicitly per-browser, not
  cross-device, and the product should say so plainly rather than implying a
  cloud account.
- **It knows who it is talking to.** The signed-in identity resolves to a
  Bluesky profile (display name, bio), which is fed into the assistant's system
  prompt so replies are personalized. This can be turned off in settings for a
  generic chat.
- **Custom instructions.** Per-browser instructions the user can set to steer
  tone and behavior, like ChatGPT's custom instructions.
- **Real markdown rendering.** Headings, inline code, code blocks, lists, and
  emphasis render properly, not as raw text.
- **A gentle invitation to contribute.** The network runs because people host
  provider nodes. Where it fits naturally, suggest that capable users run one,
  as an invitation, never a gate or a nag.

## Brand Personality

Playful and delightful, held in check by restraint. The voice is warm, plain,
and human: a friendly tool, not a technical product. Delight lives in small
moments (a nice empty state, a satisfying send, a touch of character in copy),
never in visual noise or clutter. Three words: warm, effortless, quietly
characterful.

## Anti-references

- **Developer tools and consoles.** No wall-to-wall monospace, terminal motifs,
  exposed model strings, or dense control panels. This was the explicit
  redirect: make it less developer-y.
- **Crypto / web3 aesthetics.** No neon-on-black, glowing gradients, or hype
  styling. "Decentralized" must not look like a token launch.
- **Enterprise SaaS templates.** No generic card grids, hero-metric blocks, or
  stock-polished sameness.
- **Cluttered power-tools.** Settings, parameters, and network stats must not
  crowd the conversation. Knobs stay tucked away until wanted.

## Design Principles

1. **Effortless over capable-looking.** A newcomer should be chatting within
   seconds, with no jargon, setup ritual, or model-picker homework. If a choice
   trades visible power for obvious ease, choose ease.
2. **The conversation is the product.** Everything else (settings, stats, the
   network itself) recedes behind the message thread. Chrome earns its space or
   disappears.
3. **Personal by default, honest about privacy.** It greets you by name and
   remembers your chats, and it is candid that memory lives in this browser
   only. Personalization is a default the user can switch off, not a trick.
4. **Delight in the details, calm in the whole.** Character shows in moments,
   never in density. The overall surface stays quiet so the playful touches land.
5. **Invite participation, do not preach it.** The co-op depends on people
   running nodes. Nudge gently and contextually; never block use or moralize.

## Accessibility & Inclusion

Target WCAG 2.1 AA: sufficient text and UI contrast, full keyboard operability,
labeled controls, and visible focus. Honor `prefers-reduced-motion` by dropping
nonessential motion. Do not rely on color alone to carry meaning (routing mode,
status). Keep tap targets comfortable for everyday, non-expert users.
