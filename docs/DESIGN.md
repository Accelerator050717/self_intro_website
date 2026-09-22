# Visual direction

The supplied brief and the 2026-09-22 revision define the design: a quiet bilingual portfolio, generous spacing, an ice-brick display, and the original character responding to visitors. The current public navigation is Work / About / Résumé, with language and theme controls and the existing contact entry. Play and its invitation/CTA are retired.

Tokens: snow #F4F8FC, frost #E6F1FB, ice #AED0EF, blue #477CAC, ink #172C40, secondary #526A80. Dark uses deep ocean backgrounds and readable pale blue text. Local Manrope variable font for English with complete system CJK fallbacks. Restrained mono only for useful small labels.

Desktop: a left-aligned editorial introduction and a complete, oversized character on an ice-brick plinth to its right. Original solid geometry, cylindrical studs and translucent edge highlights carry the visual identity. Content uses open rows and different-sized illustrative project canvases rather than an all-purpose card grid. Mobile follows DOM order and preserves the entire character.

```
name / mark          Work About Résumé    language theme
large introduction             full character
context + two actions          studded ice plinth
selected work       project concepts + careful descriptions
about / experience
contact
```

The character is a faithful five-layer 2D rig made from the supplied front image: body, head, viewer-right upper arm, forearm and hand. Registered 720×960 layers use independent shoulder, elbow, wrist and neck pivots. A 2.6-second greeting raises the character's own arm, waves the wrist twice, then returns each joint to its neutral pose; the feet remain on the plinth. The original waving arm has been removed from the body layer, with only small garment and joint backing areas restored. The hand retains its supplied gently curled shape. This is articulated image animation, not a 3D character model.

Motion responds to clicking/tapping the character or the Say hello / 打个招呼 button. Pointer feedback moves only the head, within a restrained ±3° range. Pause/resume controls, reduced-motion behavior, page/viewport visibility and session-limited automatic welcome keep movement bounded. Resource loading or failure leaves the complete static front character visible. The interface has no view-switching strip, and whole-image tilt/bounce is not used as a substitute for arm movement. Detailed asset boundaries and joint composition are in [REVISION-ASSETS.md](REVISION-ASSETS.md).

The four supplied high-resolution reference images remain private local source material. Runtime character assets are the front image in two responsive sizes, the 128px head portrait, five rig WebP layers and their manifest; side and back images are not runtime dependencies or preloads. Neither originals nor local processing snapshots are presented as default public downloads.

All project illustrations are explicitly labeled as illustrative. No generated people, fabricated screenshots or outcome metrics. WebGL enhances the ice-brick plinth while readable static content and the SVG scene fallback remain available. The project list, six project details, About, Résumé, contact area, language switching and themes retain the established layout; removing Play closes its space without introducing another game or replacement invitation.
