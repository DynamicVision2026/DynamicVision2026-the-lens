# WO-012 · Tactile manipulation and 3D viewport (geometry lenses)

**Owner:** Builder · **Reviewer:** Product Architect · **Depends on:** WO-010 · **Target:** spike on real iPad by Nov 10; full Unfold lesson in the Dec 1 – Jan 10 geometry window
**Founder direction (Brian, Oct 13):** no retreat on 3D tactility or visual polish; stay a zero-install web app, but keep a turnkey path to an App Store shell.

## 1. Where 3D and drag live

| Lens | Manipulation | Tech |
| --- | --- | --- |
| Unfold 展開 | Rotate the box freely; drag a face open around its hinge edge; drag P along BF and watch the string straighten | **3D viewport** (Three.js via React Three Fiber) |
| Mirror 折り返す | Drag X along the river; fold the half-plane over the river (3D flip) to reveal Q′ | SVG drag + a CSS-3D/R3F fold |
| Slide 等積変形 | Drag an apex along the parallel line; the area stays equal while the shape moves | SVG drag |
| Enclose 囲む | Drag the enclosing box's edges until they snap onto the shape | SVG drag |
| Word-problem lenses | Drag bars/arms (area strip, lever pivot, frozen walker) | SVG drag |

3D is used where the math is 3D. Everywhere else the same tactile language (grab, drag, snap, glow) is applied in 2D, where it is cheaper and crisper.

## 2. Architecture

- **New package `packages/scene3d`**: `Scene3D({card, step, onSnap})`, written with `@react-three/fiber` + `@react-three/drei` (OrbitControls with damping, Line2 for thick lines). **Lazy-loaded** (`React.lazy` + dynamic import) only on lessons that need it, so the landing page, the 8-question check and 2D lessons never download Three.js.
- **The bundle carries the geometry; the app never does the math.** For `box_unfold` the validator adds `figure.mesh`: the 8 vertices, the 6 faces, each foldable face's hinge edge and fold order, and the net layout. These are drawing coordinates from a, b, h. **Snap targets are verified values:** P's snap point on BF is the `answer`; fold angles snap to 0°, 90° and 180°.
- **Rule kept:** the app may draw a live string while P is dragged, but **never prints a computed length**. The "最短！" glow fires only at the verified snap point.
- **Same scene in videos:** Remotion renders the identical R3F scene through `@remotion/three`, so lesson videos and Shorts show the same 3D the child touches.
- **Fallback:** if WebGL is unavailable, the context is lost, or `prefers-reduced-motion` is set, show the existing SVG `box_unfold` renderer (already built in WO-008), with no broken screen.

## 3. Feel (the "premium" spec)

- **Inertia:** rotation and drags use damped springs (critically damped, settle in ≤ 300 ms); a flick keeps spinning and eases out.
- **Snap:** within a token-set radius, the dragged thing pulls into place with a slight overshoot; snap = chime + 1 frame of brighter glow + a light pulse in the lens colour.
- **Glow:** emissive materials, additive glow lines, a soft rim on the active face. **No full-screen post-processing bloom on phones** (too expensive on iOS); fake it with additive geometry.
- **Haptics:** `navigator.vibrate` where it exists (Android); real haptics through the Capacitor Haptics plugin in the native shell. iOS web has none, so the motion carries the feel.
- All values (spring stiffness, snap radius, glow intensity, durations) are tokens in `tokens.motion.tactile` (Architect adds them before the spike).

## 4. Performance budgets (checked on every PR, real iPad)

- Touch → visible response within 1 frame; 60 fps while dragging on an iPad (2019, A12) and iPhone 11.
- `frameloop="demand"`: render only while something moves (battery and heat).
- `dpr` capped at 2; < 5k triangles per scene; one light + baked ambient; textures ≤ 1024².
- 3D chunk ≤ 250 KB gzipped, loaded only on 3D lessons; first interaction ≤ 2 s on 4G.
- Handle `webglcontextlost` (iOS drops contexts under memory pressure): restore or fall back to SVG.

## 5. Native-shell readiness (turnkey, not now)

- **Capacitor** wraps this exact web build later (React Native Web would mean a rewrite of our SVG/DOM scenes, so not that).
- Keep it shell-ready now: relative asset paths and a configurable `base`; client-side routing that works from `file://`/`capacitor://`; every storage call through `safeStorage` (swappable for Capacitor Preferences, which also ends Safari's 7-day storage eviction); `SITE_URL` and the store links in `launch.config.ts`; no `window.open` to checkout inside the shell.
- **Business caveat (decide before publishing):** app stores restrict selling digital content outside in-app purchase. The shell may need to be a sign-in-with-code app with purchase on the web, and Japan's newer smartphone competition rules may change the options. Check the current rules at the time.

## Spike (first PR)

`/lab/unfold?preview=1`: unfold-001 in `Scene3D` with rotate + face-open + drag-P + snap + glow, the SVG fallback, and a Remotion still of the same scene. Acceptance: the budgets above on a real iPad (founder or test family, 10-minute check), plus the Architect's headless check (Chromium + WebKit).
