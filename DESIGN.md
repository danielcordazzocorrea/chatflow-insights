# Whats·Ops visual system

## References and scope

- [Apple Brasil](https://www.apple.com/br/), captured through Firecrawl on 2026-10-29 (desktop 1440 × 900). Branding extraction reports SF Pro Text / Display, restrained typography, low visual energy, pill buttons, and minimal shadows. The screenshot URL was retrieved but its pixels were not used to assert exact layout measurements.
- [Liquid Glass Navbar](https://21st.dev/@gughigug/components/liquid-glass-navbar), previously inspected through the 21st.dev MCP. Its source was removed after the user requested a quieter navigation.
- [Dock Nav](https://21st.dev/@soralabs/components/dock-nav), found through the 21st.dev MCP as a reference for compact icon navigation. The final route tabs are implemented in the app's own CSS to fit its header and routing behavior.
- [Interactive Tech Stack Bento Grid](https://21st.dev/@themeocean/components/interactive-tech-stack-bento-grid-with-hover-effects), supplied by the user and confirmed through the 21st.dev MCP. Cursor-following spotlight behavior informed `src/components/ui/spotlight-card.tsx`.
- [Analytics Bento](https://21st.dev/@romanvasnev/components/analytics-bento), inspected through the 21st.dev MCP for chart and card rhythm. Its revenue and traffic fields were not appropriate for this product, so the existing operational data remains in use.
- Local palette concept: `design/concepts/apple-ops-dashboard-light.png`. This is a proposed app-specific adaptation, not a screenshot of Apple's site. Its pill navigation was superseded by the route tabs implemented after user feedback.

## Implementation tokens

These are proposed Whats·Ops values, not extracted Apple CSS. They live in `src/styles.css`; authentication keeps its existing structure with a light palette.

| Role | Value |
| --- | --- |
| Canvas | `#dce5e7` |
| Raised card | `#f0f5f3` to `#e9f1ee` |
| Text | `#142027` |
| Secondary text | `#455b65` |
| Action green | `#08794a` |
| Hairline | Cool gray at about 25% opacity |
| Card radius | 20px |
| Header height | 76px desktop, 70px narrow viewports |

## Component rules

- The top route tabs have three real routes: Dashboard, Chat, Campanhas. Campaign detail and template routes keep Campanhas selected. At narrow widths labels hide and accessible names remain.
- Use translucent surfaces sparingly: soft gray cards, defined hairlines, soft shadows, and dark readable text.
- The Dashboard route shows operational metrics and charts before the pipeline. Dashboard cards use real customer and message data. Spotlight follows the pointer; it is decorative and does not change data or focus order.
- Preserve current authentication form and behavior. Any structural login change requires separate user approval.
- Keep existing page data, actions, dialogs, and campaign workflow; apply the shared visual system to their surfaces.

## Evidence limits

Apple's public homepage is a marketing page, not an analytics dashboard. The muted light palette is an app-specific adaptation requested after the initial white concept; the green accent comes from Whats·Ops and the user's supplied component references. Spacing and card dimensions are implementation choices verified in the local app at desktop and narrow browser widths, not measurements taken from Apple.
