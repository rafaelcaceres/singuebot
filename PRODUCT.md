# Product

## Register

product

## Platform

web

## Users

The primary user is the **program coordinator** — the person who runs a WhatsApp program end to end. They import the participant list, configure the bot and its knowledge base, manage HSM templates, send broadcasts, and check that everything landed. They move across the whole console rather than living in one screen, and they are the one accountable when something goes wrong.

A dedicated **operator** role is planned but does not exist yet. Today the same coordinator drops into the Central de Atendimento inbox when a conversation needs a human. The design should anticipate that split arriving — the inbox is the surface most likely to become someone else's full-time workspace — without inventing a second role before it exists.

The public `/dashboard-participants` route is read by an outside audience but is not a separate brand surface; it follows the same visual system as the console.

The interface is Portuguese (pt-BR) throughout.

## Product Purpose

A participant support desk that runs over WhatsApp. An AI assistant handles conversations autonomously — answering from a RAG knowledge base, moving people through structured interview stages — and hands off to a human when the routine runs out. The console is where that whole operation is configured, watched, and corrected.

Success is **reliability at scale**. Broadcasts land. The WhatsApp 24-hour window is respected. LGPD consent is tracked. Nothing fails silently. The measure isn't how much the system does, it's that the coordinator can trust what it reports and never gets surprised.

## Positioning

The AI does the talking, you keep control. Every message the assistant sends, every rule it follows, and every handoff it makes stays inspectable and overridable — autonomy without giving up the wheel.

## Brand Personality

Calm, precise, trustworthy. The console should recede so the work is legible: nothing shouts, state is unambiguous, and the interface never performs confidence it hasn't earned. When the system is uncertain or something failed, it says so plainly rather than smoothing it over — a coordinator who has been surprised once stops trusting the dashboard entirely.

Tone in copy is direct and unhedged. No exclamation marks, no celebratory microcopy, no apologising. Portuguese that sounds like a competent colleague, not a chatbot.

## Anti-references

**The generic shadcn violet demo** — default violet primary, untinted slate neutrals, a row of identical KPI cards. It reads as unfinished, which directly undercuts trustworthy. The console has moved off it: primary is a cobalt anchored at OKLCH hue 235, and the home page leads with what needs attention rather than a uniform metric row.

**Enterprise CRM bloat** — Salesforce and Zendesk-style density without hierarchy. Endless tabs and chrome, every element competing, nothing signalling what matters right now. Density is welcome here; undifferentiated density is not.

## Design Principles

**Trust is built from legible state.** The most important thing on any screen is what the system is currently doing and whether it worked. Delivery status, queue position, window expiry, failures — these are primary content, not footnotes.

**Show the seams.** When the AI acted, the coordinator should be able to see what it sent and why, and step in. Hiding the machinery would make the product feel magical and unaccountable; accountability is the whole positioning.

**Failure is a first-class state.** Every surface is designed for the broadcast that half-landed and the message that bounced, not only the happy path. Silence is the worst possible way to report a problem.

**Density with hierarchy.** Coordinators need a lot on screen. Earn that with clear ranking — typographic weight, grouping, and restraint with color — rather than shrinking everything uniformly.

**Familiar over clever.** This is a tool people work in, not a thing they admire. Standard affordances, consistent component vocabulary screen to screen, no invented controls for standard tasks.

## Accessibility & Inclusion

Target is **WCAG 2.1 AA**: body text at 4.5:1 minimum (including placeholders), visible focus states on every interactive element, full keyboard navigation, and a `prefers-reduced-motion` alternative for any animation.

Light and dark themes are both first-class, and the console honors them: every surface renders through OKLCH tokens in `src/index.css`, and the theme toggle lives in the app header (light / dark / system). Hardcoded Tailwind grays are considered a regression — `grep -rn "bg-gray-\|bg-white\|text-gray-" src/` should stay empty.
