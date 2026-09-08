---
name: High-Contrast Industrial Dark
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1b1b'
  surface-container: '#1f1f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e2e2e2'
  on-surface-variant: '#c9c8ac'
  inverse-surface: '#e2e2e2'
  inverse-on-surface: '#303030'
  outline: '#939279'
  outline-variant: '#484833'
  surface-tint: '#c9ce00'
  primary: '#feffbe'
  on-primary: '#313300'
  primary-container: '#e1e723'
  on-primary-container: '#636600'
  inverse-primary: '#5f6200'
  secondary: '#c8c6c5'
  on-secondary: '#303030'
  secondary-container: '#474746'
  on-secondary-container: '#b7b5b4'
  tertiary: '#fcfbff'
  on-tertiary: '#00315d'
  tertiary-container: '#cee0ff'
  on-tertiary-container: '#0063b2'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e5eb29'
  primary-fixed-dim: '#c9ce00'
  on-primary-fixed: '#1c1d00'
  on-primary-fixed-variant: '#484a00'
  secondary-fixed: '#e4e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#d4e3ff'
  tertiary-fixed-dim: '#a4c9ff'
  on-tertiary-fixed: '#001c39'
  on-tertiary-fixed-variant: '#004883'
  background: '#131313'
  on-background: '#e2e2e2'
  surface-variant: '#353535'
typography:
  heading-primary-semibold:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  heading-secondary-semibold:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  heading-secondary-regular:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 28px
  title-semibold:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 25px
  title-regular:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 25px
  body-semibold:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-regular:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  description-semibold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 21px
  description-regular:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 21px
  description-underline:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 21px
  button-label:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  tips-semibold:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 18px
  tips-regular:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
---

## Brand & Style

This design system delivers a utilitarian, high-contrast digital cockpit inspired by professional-grade hardware, battery ecosystems, and outdoor precision tools. Engineered primarily for high-focus, outdoor, and low-light field conditions, the interface utilizes pure-black canvases punctuated by high-visibility volt-lime accents.

The aesthetic fuses modern dark-mode ergonomics with tactical brutalism:
- **Visual Stance:** Ultra-deep base backgrounds (`#000000`) eliminate OLED battery draw and light bleed, creating an infinite-depth stage.
- **Accents:** High-potency Brand Lime (`#E1E723`) commands visual authority, instantly telegraphing interactive focal points and status changes without requiring ornamental decoration.
- **Tone:** Uncompromising, rugged, dependable, and efficient. Every element prioritizes glanceable clarity, high luminance contrast, and immediate touch feedback.

## Colors

The palette is tuned specifically for pitch-black and outdoor readability, using graded neutral dark steps alongside calibrated semantic accents.

### Core Canvas & Surfaces
- **Canvas (`bg-primary`):** `#000000` (Gray-1000-Black) — The absolute ground layer across screens.
- **Card Surface (`card-surface`):** `#262626` (Gray-900) — Primary container elevation for tiles, grouping surfaces, and sheets.
- **Fill Surface (`fill-surface`):** `#333333` (Gray-800) — Secondary structural fill, input background, and inner module framing.
- **Tertiary Surface (`card-fill-tertiary`):** `#666666` (Gray-700) — Structural dividers, disabled states, and auxiliary badges.

### Brand & Interaction
- **Brand Default (`brand-400` / `button-primary-default` / `text-only-button` / `icon-interactive`):** `#E1E723` — Hyper-energetic lime green for active paths, focus states, and primary CTAs.
- **Brand Pressed (`brand-500` / `button-primary-pressed`):** `#CFD317` — Lower-luminance lime providing tactile press acknowledgment.
- **Text on Brand (`text-on-brand` / `icon-on-brand`):** `#000000` — Pure black text achieving maximum accessible contrast on brand surfaces.

### Text & Iconography Hierarchy
- **Text / Icon Primary (`text-primary` / `icon-primary`):** `#FFFFFF` (Gray-100-White) — High-priority labels, titles, and main values.
- **Text Assistant (`text-assistant`):** `#999999` (Gray-600) — Subtext, units, timestamps, and tertiary annotations.
- **Text / Icon Secondary (`text-secondary` / `icon-secondary`):** `#666666` (Gray-700) — Structural hints, static field labels, and secondary indicators.
- **Text Disabled (`text-disabled`):** `#CCCCCC` (Gray-500) on disabled dark surfaces; icons use `#D9D9D9` (Gray-300).
- **Disabled Element Text:** Primary disabled buttons use `#333333` (Gray-800) over `#666666`; secondary disabled buttons use `#666666` over transparent/black.

### Status & Semantics
- **Success (`success`):** `#A6D204` (Lime-500, Priority 0) — Normal runtime confirmations, fully charged status, and safe connections.
- **Regular / Informational (`regular` / `text-link`):** `#0090FF` (Blue-500, Priority 1) — Telemetry notifications, passive syncing, and hyperlinks.
- **Warning (`warning`):** `#FFD440` (Amber-400, Priority 3) — Maintenance due, thermal threshold warnings, and capacity advisories.
- **Urgent / Critical (`urgent` / `text-error` / `line-error`):** `#E63946` / `#FF4050` (Red-500, Priority 4) — Hardware faults, overload states, and persistent system errors.

## Typography

Typography relies entirely on **Inter** to maximize technical legibility across screen sizes and device densities.

- **Primary Headings (`24px / 32px`, 600 weight):** Reserved for screen headers, major dashboard metrics, and large-font navigation bars.
- **Secondary Headings (`20px / 28px`, 600 & 400 weight):** Used for modal headers, sub-view navigation titles, and section dividers.
- **Titles (`17px / 25px`, 600 & 400 weight):** The primary hierarchical anchor for card group titles, first-level module headers, and segmented selectors.
- **Body (`16px / 24px`, 600 & 400 weight):** Standard interface reading size for operational descriptions, hardware status summaries, and form text.
- **Descriptions (`14px / 21px`):** The primary utilitarian layer for list summaries, secondary parameters, and actionable text links. The `description-underline` token handles text-only interactives.
- **Tips & Annotations (`12px / 18px`):** Applied to telemetry charts, time stamps, prompt text, and inline peripheral statuses.

## Layout & Spacing

This design system uses a 4px geometric scaling rhythm optimized for compact ergonomics, touch-safe mobile targets, and structured grid density.

### Spacing Scale
- **4px (`xxs`):** Hairline gaps, internal icon-to-badge spacing, and compact chip padding.
- **8px (`xs` / `small`):** Base internal gutter, card sub-element separation, and stacked control padding.
- **12px (`sm`):** Form field inner vertical padding and icon button internal margins.
- **16px (`md` / `medium`):** Default card interior padding, horizontal margin for nested components, and standard list row gaps.
- **20px (`lg`):** Section separation within composite dashboard cards.
- **24px (`xl` / `large`):** Outer screen horizontal margins on mobile screens, primary section stack spacing.
- **32px (`xxl`):** Screen-level component blocks, modal margins, and hero telemetry separation.

### Screen Adaptations
- **Mobile (< 768px):** Single-column layout with fixed 16px or 24px outer safe margins. Interactive controls utilize full-width or paired layout buttons with standard heights (48px–56px).
- **Tablet & Desktop (≥ 768px):** Multi-column modular grid (typically 4-column for tablet, 8 or 12-column for desktop) with 16px gutters. Dashboard modules snap to `card-surface` (#262626) tiles.

## Elevation & Depth

Visual hierarchy does not depend on atmospheric shadows or soft multi-stop lighting. Instead, elevation is expressed entirely through **tonal stacking** and **crisp contour outlines**.

- **Ground Level (Elevation 0):** Pure `#000000` base screen background.
- **Surface Level (Elevation 1):** `#262626` (Gray-900) panels. Used for modular content cards, summary views, and hardware status panels.
- **Nested Level (Elevation 2):** `#333333` (Gray-800) for inset trays, secondary controls, search/input fields, and segmented control wells.
- **Floating Modals & Drawers:** Base `#262626` backed by a 60% opacity pure black backdrop scrim, bordered with a subtle 1px `#333333` perimeter line.
- **Outlines & Strokes:** Outlines are deliberate and functional. Interactive secondary elements use 1px solid white (`#FFFFFF`) or disabled gray (`#666666`) borders without gradient washes.

## Shapes

The design system standardizes on a **unified 8px radius** (`roundedness: 2`) across virtually all interactive components, cards, and modal containers.

- **Buttons & Interactive Surfaces:** All button sizes (56px, 48px, 40px, 32px) use an 8px border radius, establishing a firm, engineered silhouette.
- **Cards & Surface Panels:** 8px border radius for modular dashboard containers and battery telemetry modules.
- **Pills & Status Tags:** Micro badges and category chips scale to 4px or retain 8px to ensure structural cohesion with surrounding components.

## Components

### Buttons
All buttons feature a constant **8px border radius** with labels styled in **Inter Medium 14px**.

- **Primary Button:**
  - *Default:* Background `#E1E723` (Brand-400), text `#000000` (`text-on-brand`).
  - *Pressed:* Background `#CFD317` (Brand-500), text `#000000`.
  - *Disabled:* Background `#666666` (Gray-700), text `#333333` (Gray-800).
- **Secondary Button:**
  - *Default:* Transparent / `#000000` background, 1px outline in `#FFFFFF` (Gray-100-White), text `#FFFFFF`.
  - *Pressed:* Semi-opaque white hover overlay (`rgba(255,255,255,0.1)`), 1px `#FFFFFF` outline, text `#FFFFFF`.
  - *Disabled:* Transparent background, 1px outline in `#666666` (Gray-700), text `#666666`.
- **Button Sizing Scale:**
  - *Large (`h-56px`):* Primary mobile screen-bottom CTAs.
  - *Medium (`h-48px`):* Standard in-card actions and modal dialog actions.
  - *Small (`h-40px`):* Compact view switches and secondary side actions.
  - *xSmall (`h-32px`):* In-row table and list-item utility actions.

### Text-Only Buttons & Links
- Styled using `description-underline` or `description-semibold` in `#E1E723` (Brand-400).
- Error action variations use `#FF4050`. Inactive or informational links use `#0090FF`.

### Cards & Modules
- **Container Fill:** `#262626` (Gray-900).
- **Padding:** 16px standard, 20px on expanded dashboard modules.
- **Dividers:** 1px stroke using `#333333` (Gray-800) or high-visibility white separator `#FFFFFF` where demarcating critical telemetry.

### Form Inputs & Text Fields
- **Container Fill:** `#333333` (Gray-800) with an 8px border radius.
- **Input Text:** `#FFFFFF` (Primary), placeholder text `#666666` (Secondary).
- **Active / Focused Border:** 1.5px solid `#E1E723` (line-text-active).
- **Error State Border:** 1.5px solid `#FF4050` (line-error) with helper text in `#FF4050`.

### Status Banners & Alert Toasts
- **Urgent / Critical (Priority 4):** Persistent or full-screen modal alert using `#E63946` / `#FF4050` accents.
- **Warning (Priority 3):** `#FFD440` indicator for maintenance and operational alerts.
- **Regular (Priority 1):** Non-intrusive notification badge or telemetry status using `#0090FF`.
- **Success (Priority 0):** Positive resolution and fully operational status using `#A6D204`.