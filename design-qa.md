# Design QA

## Comparison target

- Source visual truth: `screenshots/light-preview-contents.jpeg`, `screenshots/light-preview-no-contents.jpeg`, `screenshots/light-code.jpeg`, `screenshots/dark-preview-contents.jpeg`, `screenshots/dark-preview-no-contents.jpeg`, `screenshots/dark-code.jpeg`, and `/var/folders/w8/w4w7h1dx4_1dxjsr8kp_smy80000gn/T/codex-clipboard-c201aa34-b042-4df2-85f2-98f8d2f6b0da.png` for the scrolled sticky-toolbar state.
- Annotation 1 source-state reproduction: `design-qa-artifacts/annotation-1-source-1323x674.png`, captured at the annotated 1323 x 674 viewport with Dark theme, Preview mode, Outline open, and the original `24px 16px 72px` root padding.
- Implementation: the built extension rendered by `http://127.0.0.1:4173/viewer.html` in the Codex in-app browser.
- Desktop viewport: 1442 x 900 CSS pixels.
- Mobile viewport: 390 x 844 CSS pixels.
- Browser device pixel ratio: 2. Browser implementation captures are 1442 x 900 or 390 x 844 pixels; source screenshots are 2872 pixels wide and were cropped to the viewer region and normalized to 1442 x 900 before comparison.
- Compared states: light Preview with Outline, dark Preview without Outline, light Code, light Raw, scrolled sticky toolbar, and mobile Outline drawer.

## Evidence

- Full-view comparison: `design-qa-artifacts/comparison-light-preview-contents.png`
- Full-view comparison: `design-qa-artifacts/comparison-dark-preview-no-contents.png`
- Full-view comparison: `design-qa-artifacts/comparison-light-code.png`
- Raw implementation: `design-qa-artifacts/implementation-light-raw-visible.png`
- Sticky-toolbar implementation: `design-qa-artifacts/implementation-sticky-toolbar-scrolled.png`
- Mobile drawer implementation: `design-qa-artifacts/implementation-mobile-outline-drawer.png`
- Annotation 1 full-view comparison: `design-qa-artifacts/comparison-annotation-1-padding.png` (source state on the left, updated implementation on the right).

The full-view comparisons are sufficient for the main layout, typography, palette, and Code-density checks. The sticky toolbar and mobile drawer use focused implementation captures because their reference truth is an interaction state rather than a separate full-page composition.

## Findings

No actionable P0, P1, or P2 findings remain.

- Fonts and typography: the implementation uses GitHub's system-font and monospace stacks, with matching heading hierarchy, source density, and readable line height. Text wrapping and content hierarchy align with the normalized references.
- Spacing and layout rhythm: the viewer fills the available desktop width, `#mm-root` has zero outer padding at desktop and mobile sizes, the no-Outline reading column is capped at 1012px, the Outline occupies a fixed right rail, and the toolbar sticks at the viewport edge while remaining attached to the viewer frame.
- Colors and visual tokens: light tokens match the reference's white/subtle-gray treatment. Dark background and code-surface colors were sampled from the source and now use `#212830` and `#282c35`.
- Image and icon fidelity: no raster imagery is present in the target. Disclosure, Outline, and close icons come from GitHub's official Octicons library. Copy/download icons are intentionally absent for this pass.
- Copy and content: Preview, Code, Raw, Outline, Theme, document statistics, and fixture content are present. Removed copy/download actions do not appear in the UI.
- Interactions and accessibility: Preview/Code/Raw work; Code shows line numbers, syntax highlighting, and collapsible heading sections; Raw has no line numbers or highlighting; Outline state survives temporary Code/Raw switches; the mobile drawer opens/closes; all key controls have accessible names; browser console reported no errors.

## Comparison history

1. Initial browser capture had no styling because the development harness served the built stylesheet with the wrong MIME type. The harness now serves explicit CSS and JavaScript MIME types; the post-fix capture loads `content.css` and matches the target styling.
2. The initial frame and no-Outline reading column were too narrow at 1280px and 800px. They were changed to use the available 1440px frame and the GitHub-like 1012px reading column. Post-fix evidence: `comparison-light-preview-contents.png` and `comparison-dark-preview-no-contents.png`.
3. The initial dark background used `#0d1117`, which was visibly darker than the supplied screenshots. Source sampling found `#212830` for the viewer and `#282c35` for code surfaces; those values now match in the post-fix dark comparison.
4. Hiding the mobile Outline button's text also removed its accessible name. An explicit `aria-label` was added; the drawer was then opened and closed successfully at 390 x 844.
5. Annotation 1 identified `24px 16px 72px` desktop root padding plus a separate narrow-screen override. The root now uses `padding: 0` without a mobile override. At 1323 x 674, computed padding is `0px` on every side and both `#mm-root` and `.mm-viewer-frame` begin at x=0, y=0 with a width of 1323px. Post-fix evidence: `comparison-annotation-1-padding.png`; the browser console reported no errors.

## Implementation checklist

- [x] Preview, Code, and Raw states
- [x] Light, Dark, and Auto themes with persisted theme preference
- [x] Desktop Outline rail and narrow-screen drawer
- [x] Sticky viewer-attached toolbar
- [x] Code line numbers, syntax highlighting, and heading folding
- [x] Plain Raw source without line numbers
- [x] Copy/download controls removed from this pass
- [x] Desktop and mobile browser checks with no console errors
- [x] Full-bleed root container with zero outer padding across breakpoints

## Follow-up polish

No blocking polish remains. Copying and downloading can return later without changing the established layout model.

final result: passed
