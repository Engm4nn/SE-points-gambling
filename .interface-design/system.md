# StreamSlots Design System

## Intent
Late-night Twitch viewer gambling SE points for fun. Neon arcade cabinet in a dark room. Synthwave meets slot machine. Social entertainment, not serious gambling.

## Direction
Retro-futurism arcade — the interface IS the machine, not cards in a dashboard. Every surface is a part of the cabinet: the void between machines, the machine body, recessed panels, raised controls.

## Signature
**Current-flow payline** — electric energy flows through the active line on the reels, extends to jackpot border glow, spin button shimmer, and win discharge effects. Cyan (#06B6D4) is the signature color for this current.

## Depth Strategy
**Borders-only** — machines use bezels, not shadows. All separation via rgba borders at 4 opacity levels (bezel, bezel-soft, bezel-strong, bezel-max). No drop shadows in the layout.

## Surface Elevation (same hue, lightness only)
- L0 `--void` #0B0B1A — darkness between machines
- L1 `--machine` #111128 — cabinet body, sidebar
- L2 `--panel` #18183A — card surfaces, controls bg
- L3 `--raised` #1F1F4A — dropdowns, elevated controls
- Inset `--inset` #0E0E22 — inputs, reel wells

## Color
- **Brand (phosphor):** #7C3AED — purple neon tube glow
- **CTA (signal-hot):** #F43F5E — rose, action, urgency
- **Value (discharge):** #FBBF24 — gold, wins, jackpot
- **Success (signal-go):** #34D399
- **Error (signal-stop):** #F87171
- **Signature (current):** #06B6D4 — payline, flow

## Typography
- Headlines: Russo One — machine labels, game text
- Body: Chakra Petch 300-700 — digital readouts
- Data: Chakra Petch with tabular-nums

## Spacing
4px base: 4, 8, 12, 16, 20, 24, 32, 40, 48

## Border Radius
Sharp-technical: 4px (sm), 8px (md), 12px (lg), 16px (xl)

## Icons
Lucide React — SVG only, no emojis in UI (emojis only for slot symbols)

## Key Patterns
- Toast: dark panel bg with colored text and colored border (not colored bg)
- Buttons: border-only default, filled for primary actions
- Payline: cyan borders with directional gradient background
- Jackpot: current-flow animation on border pseudo-element
- Spin button: current-shimmer pseudo-element animation
