# Poke Factory Design System

Version: 1.0
Status: Active source of truth
Project: Poke Factory
Last updated: 2026-04-04

## 1. Purpose

This document defines the canonical UI system for Poke Factory.
All new UI work should follow this file unless a page-level override is created under `design-system/pages/`.

The goal is not to replace the current product identity. The goal is to unify the existing visual language into one consistent system that fits:

- Pokemon-inspired collection and battle fantasy
- Mobile-first gameplay
- Fast state recognition during battles
- Lightweight React and Tailwind implementation

## 2. Product Positioning

Poke Factory should feel like a bright tactical battle terminal.

It is not:

- A generic SaaS dashboard
- A dark cyberpunk interface
- A pure pixel-art retro clone

It is:

- A modern light-theme game UI
- A battle operations console with arcade energy
- A collectible strategy interface with clear information density

Working style name:

`Light Retro Arcade Ops`

This style blends the current clean light surfaces with selective retro-futurist accents.

## 3. Core Principles

1. Readability wins during gameplay.
Keep stats, moves, selection states, and battle feedback easier to parse than decorative effects.

2. Bright base, high-energy accents.
Use light page backgrounds and white panels as the default canvas. Use saturated accents only for actions, rewards, rarity, and battle states.

3. Two visual layers.
There are two distinct but compatible layers:
- System Layer: menus, collection, settings, filters, records, status HUD
- Battle Layer: selection cards, combat actions, rewards, progression moments

4. Motion communicates change.
Animations should teach state changes: enter screen, confirm selection, reward reveal, battle impact, modal focus.

5. Mobile first, desktop expanded.
Every screen must work cleanly on narrow portrait layouts before getting richer on tablet and desktop.

## 4. Visual Direction

Primary direction:

- Light neutral background
- White and soft blue surfaces
- Bold cobalt blue as the main brand color
- Warm orange reserved for high-priority CTA moments
- Red, gold, emerald, and violet for state and reward semantics
- Mild patterned overlays inspired by battle terminals and print scanlines

Retro-futurism is allowed in accents only:

- subtle stripe overlays
- occasional scanline texture
- stylized badges
- angled labels
- rare glow on high-value actions or reward states

Do not apply heavy glitch, neon, or CRT treatments across entire pages.

## 5. Color System

### 5.1 Base Palette

These values extend the current palette and should become canonical tokens.

```ts
export const UI_TOKENS = {
  bg: {
    pageTop: '#F8FAFC',
    pageBottom: '#EEF2F7',
    pageAccent: '#E2E8F0',
    stripe: 'rgba(148,163,184,0.18)',
  },
  surface: {
    base: '#FFFFFF',
    soft: '#F3F6FA',
    muted: '#E8EEF6',
    raised: '#FFFFFF',
    inset: '#E2E8F0',
  },
  text: {
    strong: '#0F172A',
    body: '#1E293B',
    muted: '#64748B',
    faint: '#94A3B8',
    inverse: '#FFFFFF',
  },
  brand: {
    primary: '#2563EB',
    secondary: '#0EA5E9',
    cta: '#F97316',
  },
  state: {
    success: '#10B981',
    warning: '#EAB308',
    danger: '#EF4444',
    info: '#3B82F6',
    special: '#8B5CF6',
  },
  border: {
    soft: '#E2E8F0',
    strong: '#CBD5E1',
    active: '#2563EB',
    dark: '#0F172A',
  },
} as const;
```

### 5.2 Color Roles

- Blue is the default action color.
- Orange is reserved for the single strongest CTA on a screen.
- Green is used for successful progression, cleared sets, obtained rewards.
- Red is used for danger, HP loss, failed runs, hostile battle emphasis.
- Gold is used for tokens, premium rewards, milestone states.
- Violet is reserved for special mechanics and advanced progression, not everyday buttons.

### 5.3 Background Rules

- All main pages use a light vertical gradient background.
- Pages may add one low-opacity patterned overlay.
- Never combine more than one global texture and one local glow in the same viewport.

## 6. Typography

### 6.1 Type Strategy

Do not use pixel fonts for the full application.

Use a split typography system:

- Display and milestone text: arcade-flavored
- UI body and labels: modern sans-serif

Recommended implementation:

- Display font: `Press Start 2P` for rare use, or `Oxanium` as a more practical arcade display font
- UI font: keep `Inter`

Preferred production choice:

- `Oxanium` for headings, section labels, CTA numerics
- `Inter` for body, supporting labels, controls, data density

Fallback choice if we want zero font churn in phase 1:

- Keep `Inter` only, but emulate arcade tone through letter spacing, weights, and all-caps labels

### 6.2 Typography Roles

- App title: uppercase, heavy, display font or stylized Inter
- Section title: 18 to 24px, bold, tight line-height
- Card title: 14 to 18px, bold, uppercase only when thematic
- Numeric stat: tabular feel, high weight
- Micro label: 9 to 11px, uppercase, wide tracking
- Body copy: 13 to 15px, sentence case, readable spacing

### 6.3 Typography Rules

- Avoid long all-caps paragraphs.
- Use uppercase for labels, tabs, badges, and action words only.
- Chinese text must remain readable; do not force decorative display fonts on Chinese body copy.

## 7. Shape Language

### 7.1 System Layer Shapes

Use for:

- home navigation
- top HUD
- settings
- filters
- collection controls
- info surfaces

Rules:

- rounded corners: 12px to 20px
- soft borders
- soft elevation
- balanced spacing

### 7.2 Battle Layer Shapes

Use for:

- rental cards
- confirm buttons
- battle actions
- reward states
- progression labels

Rules:

- squared or slightly rounded cards
- angled ribbons and skewed labels
- stronger borders
- stronger contrast

### 7.3 Mixing Rule

On any single screen, System Layer should be the default container language.
Battle Layer should appear only on the primary interactive zone.

Example:

- Start screen: mostly System Layer, one Battle Layer hero CTA
- Factory select: System Layer frame, Battle Layer cards and confirmation action
- Battle screen: System Layer HUD, Battle Layer action controls

## 8. Elevation, Border, and Texture

### 8.1 Elevation

Use only three levels:

- Level 0: flat or inset
- Level 1: cards and toolbar surfaces
- Level 2: modal, reward, and focused interactive states

Avoid stacking multiple shadows on the same component.

### 8.2 Borders

- Soft border for passive panels
- Strong dark border for key battle surfaces
- Accent border for active or selected states

### 8.3 Texture

Allowed textures:

- light diagonal stripe overlay
- subtle scanline overlay at very low opacity
- dotted or grid texture for section backgrounds

Forbidden textures:

- noisy grain everywhere
- animated glitch on base layout
- full-screen neon bloom

## 9. Motion System

### 9.1 Motion Goals

Motion should explain:

- screen entry
- selection
- confirmation
- reward reveal
- transition to battle

### 9.2 Standard Motion

- Screen entry: fade + 8 to 16px translate
- Card hover: 1.01 to 1.03 scale
- Confirm action: short compress then release
- Reward reveal: staggered rise + fade
- Combat impact: localized shake or flash only on affected element

### 9.3 Motion Limits

- Default duration: 160ms to 280ms
- Large screen transition: up to 400ms
- Infinite animation only for decorative companion, loading, or ambient texture

### 9.4 Accessibility

All non-essential motion must degrade under `prefers-reduced-motion`.

## 10. Component Rules

### 10.1 App Shell

Applies to the overall game viewport.

Rules:

- keep fixed full-height game shell
- maintain centered max-width on desktop
- preserve one ambient background texture
- avoid introducing nested full-screen scroll areas unless necessary

Maps to current code:

- `src/features/game/components/GameView.tsx`

### 10.2 Top HUD / Record Panel

Role:

- show current run essentials fast

Rules:

- compact, horizontally chunked
- one identity stripe or top rule
- icons are supporting, not primary
- values should dominate labels

Keep:

- current compact chip-based structure

Improve:

- standardize all HUD labels to one micro-label style
- ensure every value aligns consistently across pages

Maps to current code:

- `src/features/game/components/game-view/TopRecordPanel.tsx`

### 10.3 Primary CTA

Role:

- start battle flow
- confirm team selection
- continue after milestone moments

Rules:

- one primary CTA per screen
- use orange only when the action is the main forward action
- shape can be circular on home or skewed rectangular in battle flows
- include a distinct active, pressed, disabled, and loading state

### 10.4 Navigation Dock

Role:

- persistent access to collection, events, settings, and future systems

Rules:

- icon + short label
- clear active state
- lock state must be distinct from disabled style
- badges must share one placement and size rule

Current gap:

- active destination is not strongly indicated

Maps to current code:

- `src/features/game/components/game-view/StartScreen.tsx`

### 10.5 Pokemon Card

Role:

- selection, inspection, replacement, reward comparison

Rules:

- artwork first
- name second
- type chips third
- stats in compact matrix
- actions last

Card variants:

- compact card: mobile selection grid
- tactical card: desktop selection
- reward card: celebratory framing
- info card: data dense, scrollable

Selection states:

- default
- hover
- selected
- unavailable
- newly acquired

### 10.6 Type Badge

This is already one of the strongest visual elements in the project and should stay close to its current form.

Rules:

- keep embossed layered treatment
- preserve per-type chroma
- keep uppercase short labels
- do not add extra decorative backgrounds behind badges

Maps to current code:

- `src/components/TypeBadge.tsx`

### 10.7 Battle Action Panel

Role:

- highest clarity zone in the app

Rules:

- strict hierarchy of main action, sub action, disabled state
- move category and type must be readable within 1 second
- damage and risk emphasis should use state color, not extra ornament
- do not overload this area with decorative textures

### 10.8 Modal and Overlay

Use for:

- Pokemon info
- replace prompt
- reward learn/replace moments

Rules:

- darkened backdrop
- strong focus container
- visible close/back affordance
- body scroll isolated inside modal content only

## 11. Page Patterns

### 11.1 Start Screen

Narrative:

- command center
- top records
- central battle core
- bottom utility dock

Layout:

- top: compact record panel
- center: one hero CTA
- bottom: dock menu

Visual emphasis:

- hero button gets the most contrast
- companion animation remains playful secondary flavor

Keep from current screen:

- centered action structure
- bottom dock pattern
- floating companion

Change next:

- stronger battle-terminal identity for the hero area
- clearer active/locked states in bottom dock
- use orange only if the main CTA should feel more urgent than blue

### 11.2 Factory Select

Narrative:

- tactical drafting table

Layout:

- top: run HUD
- middle: roster selection zone
- bottom: sticky confirmation action

Visual emphasis:

- selected cards must read instantly
- confirm action must become unmistakable once 3 picks are valid

Keep from current screen:

- desktop battle-card energy
- strong selected state
- sticky bottom confirmation zone

Change next:

- align mobile and desktop card language more closely
- unify button heights and label sizing
- introduce clearer rarity or specialty accents later if needed

### 11.3 Battle Screen

Narrative:

- live arena broadcast + tactics console

Layout:

- top: enemy and player field status
- center: battle events and effects
- bottom: action choices

Rules:

- battle data must always outrank decorative style
- avoid visual competition between field, action buttons, and logs
- key combat state changes should use color, motion, and iconography in that order

### 11.4 Collection Screen

Narrative:

- research terminal

Rules:

- more systematic, less combat-styled
- search, filters, ownership state, and form information should feel tool-like
- keep battle accents restrained

### 11.5 Reward and Result Screens

Narrative:

- celebration and progression checkpoint

Rules:

- more glow and saturation than normal screens
- one focal reward card or result badge
- surrounding UI should quiet down to frame the reward

## 12. Interaction and UX Rules

### 12.1 Navigation

- current location must always be visually indicated
- back actions must be consistent by placement and icon
- locked destinations are visible but clearly not actionable

### 12.2 State Feedback

- selection must reflect immediately
- loading must always show meaning, not only a spinner
- reward gain should have a distinct success state
- battle errors or invalid actions need immediate, plain-language feedback

### 12.3 Accessibility

- visible focus indicators
- semantic heading order
- touch targets at least 44px where possible
- icon-only buttons require labels or aria text
- color must not be the only selected-state signal

### 12.4 Responsive Targets

Required checkpoints:

- 320
- 375
- 414
- 768
- 1024
- 1440

## 13. Implementation Mapping

### 13.1 Existing Code to Preserve

- light background + stripe logic in `src/features/game/components/GameView.tsx`
- palette foundation in `src/theme/palette.ts`
- home shell structure in `src/features/game/components/game-view/StartScreen.tsx`
- tactical card energy in `src/features/game/components/game-view/FactorySelectScreen.tsx`
- type badge treatment in `src/components/TypeBadge.tsx`

### 13.2 Tokenization Work

Move repeated one-off values into reusable tokens for:

- page background and texture
- panel surface styles
- battle card styles
- CTA styles
- HUD chip styles
- status colors
- motion durations
- border radii

### 13.3 New Shared Primitives to Add

Recommended shared primitives:

- `ScreenFrame`
- `HudPanel`
- `PrimaryAction`
- `BattleCard`
- `SectionTitle`
- `StatusPill`
- `TextureOverlay`

## 14. Rollout Plan

Execute in this order.

### Phase 1: Foundation

Goal:

- unify tokens and page shell without changing game logic

Tasks:

- formalize palette tokens
- add typography tokens
- create shared surface, border, and CTA class recipes
- add reduced-motion handling
- clean up any corrupted comments or legacy style notes in global CSS

Definition of done:

- new screens can use a shared token vocabulary
- no visible regressions in start and selection flows

### Phase 2: Home and Shell

Goal:

- make the app shell and home page fully match the system

Tasks:

- refine global shell background
- strengthen hero CTA identity
- standardize bottom dock states
- align top record panel spacing and labels

Definition of done:

- start screen reads as the canonical visual identity of the app

### Phase 3: Factory Select

Goal:

- unify tactical drafting UI across mobile and desktop

Tasks:

- create shared card variants
- align selected, hover, and disabled states
- standardize info and confirm controls
- reduce visual gap between compact and large-card layouts

Definition of done:

- team drafting feels like one system on every breakpoint

### Phase 4: Battle HUD

Goal:

- improve combat readability and feedback hierarchy

Tasks:

- standardize panel layering
- reduce decorative competition
- improve action-state hierarchy
- tune effect motion and damage emphasis

Definition of done:

- battle information is scannable in under one second

### Phase 5: Collection, Reward, and Settings

Goal:

- bring support screens into the same system

Tasks:

- shift collection toward research-terminal styling
- give reward screens a stronger celebration frame
- make settings consistent with system-layer panels

Definition of done:

- every screen feels like part of the same product

## 15. Non-Goals

Do not do these during the initial rollout:

- full dark mode
- full pixel-font UI
- heavy cyberpunk neon redesign
- replacing all component shapes with brutalist rectangles
- adding excessive particle effects or full-screen glitch animation

## 16. Acceptance Checklist

Before considering any page aligned with the system, confirm:

- The page has one clear primary action
- Surface hierarchy is obvious at a glance
- Selected state is recognizable without relying only on color
- Labels and values are typographically distinct
- Motion supports understanding instead of decoration
- Mobile layout works before desktop enhancements
- The page matches either System Layer or Battle Layer with intent
- Decorative effects do not reduce readability

## 17. Working Rule

If a new UI decision conflicts with this document, prefer:

1. clarity
2. consistency
3. theme

That priority order is mandatory.
