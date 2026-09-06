---
name: High-Voltage Industrial Innovation
colors:
  surface: '#121315'
  surface-dim: '#121315'
  surface-bright: '#38393b'
  surface-container-lowest: '#0d0e10'
  surface-container-low: '#1a1c1d'
  surface-container: '#1e2022'
  surface-container-high: '#292a2c'
  surface-container-highest: '#343537'
  on-surface: '#e3e2e4'
  on-surface-variant: '#c8c8ad'
  inverse-surface: '#e3e2e4'
  inverse-on-surface: '#303032'
  outline: '#92927a'
  outline-variant: '#474834'
  surface-tint: '#c4d00b'
  primary: '#ffffff'
  on-primary: '#2f3300'
  primary-container: '#d4e128'
  on-primary-container: '#5c6200'
  inverse-primary: '#5d6300'
  secondary: '#c7c6c8'
  on-secondary: '#303032'
  secondary-container: '#48494b'
  on-secondary-container: '#b9b8ba'
  tertiary: '#ffffff'
  on-tertiary: '#003827'
  tertiary-container: '#6afbc5'
  on-tertiary-container: '#007353'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e0ec35'
  primary-fixed-dim: '#c4d00b'
  on-primary-fixed: '#1b1d00'
  on-primary-fixed-variant: '#464a00'
  secondary-fixed: '#e3e2e4'
  secondary-fixed-dim: '#c7c6c8'
  on-secondary-fixed: '#1b1c1d'
  on-secondary-fixed-variant: '#464748'
  tertiary-fixed: '#6afbc5'
  tertiary-fixed-dim: '#48deaa'
  on-tertiary-fixed: '#002115'
  on-tertiary-fixed-variant: '#00513a'
  background: '#121315'
  on-background: '#e3e2e4'
  surface-variant: '#343537'
  status-ideas: '#d4e128'
  status-feasibility: '#e69b38'
  status-active: '#3fa9f5'
  status-proven: '#38d39f'
typography:
  display-hero:
    fontFamily: DM Sans
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.02em
  display-hero-mobile:
    fontFamily: DM Sans
    fontSize: 34px
    fontWeight: '700'
    lineHeight: 42px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: DM Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: DM Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: DM Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: DM Sans
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
  stat-metric:
    fontFamily: DM Sans
    fontSize: 64px
    fontWeight: '800'
    lineHeight: 64px
    letterSpacing: -0.03em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: DM Sans
    fontSize: 15px
    fontWeight: '700'
    lineHeight: 20px
  label-md:
    fontFamily: DM Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 16px
  label-caps:
    fontFamily: DM Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  space-3xl: 4rem
  space-4xl: 6rem
  gutter-mobile: 0.75rem
  gutter-tablet: 1rem
  gutter-desktop: 1.5rem
  margin-mobile: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2rem
  container-max: 1320px
---

## Brand & Style

This design system establishes an authoritative, high-energy industrial engineering aesthetic calibrated for advanced outdoor power equipment, modular hardware architectures, and digital R&D operations. It merges heavy-duty mechanical grit with the precision telemetry of electrified powertrains.

### Brand Personality & Philosophy
- **Electrified Precision:** Signature volt chartreuse accents cut through deep carbon surfaces, embodying battery-driven torque, clean industrial energy, and digital telemetry.
- **Utilitarian Clarity:** High contrast values and structured framing prioritize instant legibility for engineering specifications, prototype pipelines, and technical telemetry.
- **Tactile Modernism:** Interlocking chevron flows, pill-shaped tactile controls, and layered dark charcoal containers recreate the experience of rugged workshop consoles and modular power-pack interfaces.

### Design Movement
The interface operates at the intersection of **High-Contrast Bold Industrialism** and **Modern Dark-Surface Telemetry**. It rejects soft skeuomorphism in favor of crisp borders, targeted luminescent indicators, disciplined modular grids, and tactile pill geometries that facilitate rapid technical decision-making.

## Colors

The color palette is engineered around high-voltage contrast to deliver extreme visibility in low-reflection environments. The primary electrified chartreuse commands instant focus, while structural charcoal neutrals prevent visual fatigue across complex multi-panel dashboards.

### Color Tokens & Roles
- **Primary (`#f1fe47` / `#d4e128`):** High-voltage chartreuse reserved for primary interactive triggers, active navigation markers, chevron accents, and key numerical telemetry. Text placed on primary surfaces must use deep olive `#2f3300` or solid charcoal `#121315` to preserve accessibility.
- **Secondary (`#c7c6c8`):** Precision steel gray utilized for secondary interactive triggers, inactive borders, and structural icons.
- **Tertiary (`#5df0ba` / `#cdffe6`):** Electric mint accent for system validations, positive telemetry, and completed milestones.
- **Neutral Surface Stack:**
  - `surface-container-lowest` (`#0d0e10`): Inset viewports, terminal displays, and media backing.
  - `surface` / `background` (`#121315`): Base canvas across all viewports.
  - `surface-container` (`#1e2022`): Standard modular card substrate and toolbars.
  - `surface-container-high` (`#292a2c`): Hovered states, modal dialogues, and elevated panels.
  - `surface-container-highest` (`#343537`): Pill tags, segmented button tracks, and search bar backgrounds.

### Functional Status Indicators
- **Ideas:** Soft Volt Chartreuse (`#d4e128`)
- **Feasibility Study:** Radiant Industrial Amber (`#e69b38`)
- **Active Project:** Precision Telemetry Blue (`#3fa9f5`)
- **Market Proven:** Emerald Teal (`#38d39f`)
- **Fault / Alert:** High-Visibility Coral Red (`#ffb4ab`)

## Typography

The typographic hierarchy combines **DM Sans** for bold, assertive industrial display elements and interactive triggers with **Inter** for dense, clean technical metadata and long-form engineering reports.

### Typographic Rules
- **Headline Emphasis:** Display headlines pair crisp white text (`#e3e2e4`) with wrapped spans of primary chartreuse (`#f1fe47`) to isolate actionable concepts or technical milestones.
- **Instrument Telemetry:** The `stat-metric` level is reserved for raw counters, cycle indicators, and battery efficiency stats. Numerical values must render with tabular figures (`font-variant-numeric: tabular-nums`) to prevent jitter during real-time data streaming.
- **Labels & Tags:** The `label-caps` token requires full uppercase casing with `0.06em` tracking for hardware model prefixes, telemetry status tags, and table headers.

## Layout & Spacing

Layouts follow an adaptive 12-column system capped at a maximum width of `1320px`. The spatial rhythm derives strictly from an 8px base unit (halved to 4px for tight hardware labels).

### Responsive Breakpoint Adaptations
- **Desktop (>= 1200px):** 12 columns, 24px gutters, dynamic outer margins centering within 1320px. Pipeline funnels lay out horizontally across all 4 stages. Card catalogs follow a 4-column layout (`col-span-3`).
- **Tablet (768px – 1199px):** 8 columns, 16px gutters, 24px outer margins. Card catalogs collapse to 2 columns (`col-span-4`). Chevron funnels reconfigure into a 2x2 grid.
- **Mobile (< 768px):** 4 columns, 12px gutters, 16px margins. Card grids collapse to a single column. Horizontal funnels convert to a vertical step process.

### Density & Vertical Cadence
- Major content zones and hero sections deploy `space-3xl` (64px) to `space-4xl` (96px) vertical margins.
- Card interiors enforce an internal padding of `space-md` (16px), with `space-xs` (8px) gaps separating sub-tags and author credits.

## Elevation & Depth

Visual hierarchy avoids soft, diffused drop shadows. Instead, it relies on stacked tonal charcoal surfaces, crisp structural boundaries, and localized neon luminescence.

### Tonal Stratification
- **Substrate (Level 0):** Canvas base `#121315` provides an anti-glare foundation.
- **Structural Modules (Level 1):** Cards and panels render with `#1e2022` and a 1px perimeter outline of `#292a2c`.
- **Floating Controls (Level 2):** Flyout drawers, dropdowns, and elevated headers use `#292a2c` with a 1px border of `#474834`.

### Glow & Active Elevation
- **Interactive Focus & Hover:** Hovered cards lift `-4px` along the Y-axis, shifting the border color from `#292a2c` to `#d4e128`.
- **Luminescent Accent Outline:** Active process steps and high-priority states utilize a 1.5px border colored in `#f1fe47` reinforced by a tight ambient rim glow: `box-shadow: 0 0 16px rgba(212, 225, 40, 0.22)`.

## Shapes

The design system pairs industrial structural angularity with ergonomic pill-shaped touch surfaces.

### Shape Application Guidelines
- **Card Containers:** Standard card shells use a medium `0.75rem` (12px) to `1rem` (16px) corner radius, balancing machine rigidity with digital clarity.
- **Interactive Controls (Pill Standard):** Search bars, filter chips, primary buttons, and stage tags leverage a full pill radius (`rounded-full` / `9999px`).
- **Nested Elements:** Internal media thumbnails conform to `0.5rem` (8px) corner rounding to maintain a 4px inset delta from parent card shells.
- **Process Chevrons:** Directional polygons featuring inset right-pointing interlocking edges, unified by `rounded-full` apex badge indicators.

## Components

### Buttons
- **Primary High-Volt Button:** Filled with chartreuse `#d4e128`, dark text `#121315`, `label-lg` weight, pill radius (`9999px`), 14px vertical and 28px horizontal padding. On hover: scale transform (`1.02`), background shifts to `#f1fe47`, and displays a localized chartreuse rim glow.
- **Secondary Outlined Button:** Dark slate background `#1e2022`, 1px border `#474834`, text `#e3e2e4`, pill-shaped. On hover: border promotes to `#d4e128`, text to `#ffffff`.
- **Action Links:** Text in `#d4e128` with an inline chevron (`Visit Link >`), translating +4px horizontally on hover.

### Chips & Badges
- **Pill Filter Chips:** Pill-shaped (`rounded-full`) chips with 1px border `#474834` and text `#c7c6c8`. When selected, the background transitions to `#d4e128` with `#121315` text and an integrated circular badge bubble.
- **Status Badges:** Compact pill tags (`label-caps`) with translucent colored backgrounds (15% opacity) and solid text:
  - Ideas: `#d4e128`
  - Feasibility Study: `#e69b38`
  - Active Project: `#3fa9f5`
  - Proven: `#38d39f`

### Inputs & Search
- **Search Field:** Full pill shape (`9999px`), background `#1e2022`, 1.5px border `#343537`, height 48px, leading search icon in `#92927a`, and placeholder text in `#92927a`. On focus: border shifts to `#f1fe47` with an ambient glow (`box-shadow: 0 0 12px rgba(241, 254, 71, 0.25)`).

### Selection Controls (Checkboxes & Radios)
- **Checkboxes:** 20px squares with `0.25rem` (4px) rounded corners, background `#1e2022`, 1.5px outline `#474834`. When checked: fill transitions to `#d4e128` with a dark charcoal checkmark.
- **Radio Buttons:** 20px circular controls. When selected: outer ring `#f1fe47` containing a 10px centered solid chartreuse pip.

### Innovation Chevron Process Funnel
- **Geometry:** 4-stage interlocking pentagon track (Technology, Ideas, Feasibility Study, Projects).
- **Surface:** Filled with linear dark gradient (`#1e2022` to `#121315`), bordered by a 1.5px `#474834` stroke (active stage switches to `#f1fe47` with neon glow).
- **Telemetry Node:** Top apex features a 48px circular icon container (`rounded-full`) with a centered hardware icon. The bottom module pairs stage titles with oversized `stat-metric` numerical counters.

### Cards
- **Standard Prototype Card:**
  - **Structure:** Background `#1e2022`, 1px border `#292a2c`, `rounded-lg` (12px), vertical lift of `-4px` and `#d4e128` border on hover.
  - **Media Area:** 16:9 aspect ratio media container, nested 8px radius, with a top-right floating favorite button (translucent circle with icon).
  - **Body Content:** Bold title (`headline-sm`) in `#e3e2e4`, timestamp in `#c8c8ad` (`body-sm`), followed by prototype taxonomy tags.
  - **Footer:** Dual column layout dividing author profile (avatar + name) and a right-aligned functional status badge.
- **Partner Card:**
  - Horizontal card presentation featuring a square media preview on the left and company specs, motor tags, contributor info, and an active "Visit Link >" prompt on the right.