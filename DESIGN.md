# Athenemy Design System

## Brand Direction

Athenemy should feel calm, premium, scholarly, and trustworthy. The visual language is inspired by Athena as a symbol of wisdom, but the product must remain a modern LMS and SaaS application, not a mythology-themed website.

The brand expression is minimalist Greek wisdom: geometric, disciplined, spacious, and direct. Use symbolic references sparingly through simple shapes such as an owl eye, shield, open book, or Greek column. Avoid decorative mythology art.

## Logo

The primary logo is a clean vector-style mark plus wordmark.

- Composition: icon on the left, wordmark "Athenemy" on the right.
- Background: deep royal navy.
- Mark color: metallic gold.
- Wordmark color: metallic gold.
- Style: flat vector, minimalist, geometric, premium.
- Use case: SaaS app header, sidebar, public portal header, auth screens, certificates, and export surfaces.

The logo must remain legible at small sizes. Prefer strong simple geometry over detailed illustration.

### Logo Motif

Use one subtle Athena-inspired symbol only:

- Owl-eye motif for wisdom.
- Shield motif for trust and structure.
- Open book motif for learning.
- Greek column motif for scholarship.

Do not combine multiple symbols unless the result still reads as one simple mark.

### Logo Constraints

Do not use:

- Multiple logo variations in one asset.
- Logo sheets.
- Mockup backgrounds.
- 3D effects.
- Gradients.
- Glow.
- Bevels.
- Shadows.
- Tiny details.
- Full goddess faces.
- Realistic helmets.
- Illustration scenes.
- Taglines.
- Extra icons.
- Color palette displays inside logo artwork.
- Typography boards inside logo artwork.

## Color

The brand palette is intentionally narrow. Use only two main brand colors.

| Token         |       Hex | Role                                                         |
| ------------- | --------: | ------------------------------------------------------------ |
| Royal Navy    | `#071A3D` | Primary brand background, app chrome, high-emphasis surfaces |
| Metallic Gold | `#D4AF37` | Brand mark, wordmark, premium accents, certificate emphasis  |

### Color Strategy

Product UI should be restrained. Royal Navy and Metallic Gold are brand anchors, not decoration. Gold should be used for brand identity, selected premium moments, certificate surfaces, and high-value visual emphasis. It should not become the default color for every button, badge, link, or chart.

### Light Theme Tokens

Use tinted neutrals that harmonize with Royal Navy.

| Token              | Suggested Value | Usage                                  |
| ------------------ | --------------: | -------------------------------------- |
| Background         |       `#F8FAFC` | Main app background                    |
| Foreground         |       `#0B1630` | Primary text                           |
| Card               |       `#FFFFFF` | Cards and form panels                  |
| Muted              |       `#F1F5F9` | Secondary panels and inactive controls |
| Muted Foreground   |       `#64748B` | Helper text and secondary metadata     |
| Border             |       `#E2E8F0` | Dividers, cards, form inputs           |
| Primary            |       `#071A3D` | Primary buttons and app identity       |
| Primary Foreground |       `#F8FAFC` | Text on primary                        |
| Gold               |       `#D4AF37` | Brand accent and certificate emphasis  |

### Dark Theme Tokens

Dark mode should protect uploaded learning content and slide imagery. Use dark navy as structure, not pure black.

| Token              | Suggested Value | Usage                                  |
| ------------------ | --------------: | -------------------------------------- |
| Background         |       `#061226` | Main dark app background               |
| Foreground         |       `#F8FAFC` | Primary text                           |
| Card               |       `#0B1730` | Cards and editing panels               |
| Muted              |       `#111E38` | Secondary panels and inactive controls |
| Muted Foreground   |       `#A7B4C8` | Helper text and secondary metadata     |
| Border             |       `#22314D` | Dividers, cards, form inputs           |
| Primary            |       `#D4AF37` | Primary emphasis where brand-led       |
| Primary Foreground |       `#071A3D` | Text on gold primary                   |
| Navy               |       `#071A3D` | Header, sidebar, branded surfaces      |

## Typography

Use a modern, legible sans-serif for product UI. System fonts are acceptable and aligned with the product’s pragmatic LMS direction.

- Prefer: Geist, Inter, SF Pro, or system UI.
- Wordmark: custom or refined geometric sans treatment, medium to semibold weight.
- UI labels: 12-14px, medium weight.
- Body: 14-16px with comfortable line height.
- Page headings: clear hierarchy, never ornamental.

Avoid display fonts, Greek novelty fonts, and decorative classical lettering in the product UI.

## Layout

The interface should feel like a serious learning operations tool.

- Prioritize content and workflows over decorative framing.
- Keep dashboards dense but readable.
- Use cards for repeated items, forms, and framed tools only.
- Do not nest cards inside cards.
- Use clear section hierarchy, predictable navigation, and visible status.
- Public portal pages should have generous spacing, but authenticated tools should remain efficient.

## Components

### Buttons

- Primary product actions can use Royal Navy in light mode.
- Gold buttons should be reserved for premium or ceremonial actions, such as certificates, billing upgrade moments, or brand-forward public portal CTAs.
- Destructive actions must remain visually distinct from brand colors.

### Cards

Cards should be quiet, functional, and low radius. Use subtle borders and restrained shadows.

### Forms

Forms should use explicit labels, helper text where useful, inline validation, and friendly action feedback. Do not rely on crashes or raw validation output.

### Navigation

Navigation should be stable and predictable:

- Dashboard: work-focused, compact, clear current state.
- Public portal: brand-led but still simple.
- Sidebar logo should use the icon plus wordmark where space allows, icon-only when collapsed.

## Public Portal

Portal theming should let organizations express their brand while keeping Athenemy’s LMS structure clear.

- Preserve learner readability above brand decoration.
- Render uploaded slides and images on surfaces that protect contrast in both light and dark mode.
- Allow public portals to use light, dark, or system theme defaults.
- Visitor theme controls should be scoped to the portal and must not affect the dashboard.

## Motion

Motion should communicate state, not decorate.

- Use 150-250ms transitions.
- Animate opacity, color, and transform only.
- Avoid bouncy, elastic, or theatrical motion.
- Respect reduced motion.

## Accessibility

The product should meet WCAG AA contrast.

- Ensure Metallic Gold on Royal Navy passes contrast for wordmark and large UI text.
- Do not use gold for small body text on light backgrounds unless contrast is verified.
- Keep focus states visible.
- All icon-only controls need accessible names.
- Forms need labels, errors, and pending states.
- Drag-and-drop interactions need keyboard-accessible alternatives.

## Voice

Copy should be calm, capable, and direct.

- Use practical LMS language.
- Prefer clear task labels over marketing phrases.
- Avoid mythology puns.
- Avoid inflated SaaS claims.
- Status messages should explain what happened and what the user can do next.

## Anti-Patterns

Avoid:

- Moodle-style clutter.
- Generic SaaS card grids.
- Decorative Greek borders, meanders, statues, marble textures, or mythology scenes.
- Overusing gold as a general accent.
- Dark-mode treatments that make imported images, slides, or screenshots hard to read.
- Raw CRUD screens.
- Hidden failures or unhandled validation errors.
