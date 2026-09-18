# Slate — Frontend Audit & Redesign Proposal

Sources: `docs/8x-assignment.pdf`, `docs/refrence/` (8 screenshots + `slate_studio_ui.tsx`), current source, and the existing backend.

> **Correction on the premise.** The eleven problems in the brief describe
> `docs/refrence/slate_studio_ui.tsx`, not the shipped Slate frontend. That file
> fabricates progress (`currentP += Math.random() * 2`), paints an Unsplash photo
> as generated output, fakes `handleEnhance` with a timer, and answers Advanced
> with `showToast("Advanced settings locked.")`. None of that exists in
> `components/studio/`. Verified by grep: no `setTimeout`/`setInterval`/
> `Math.random` in any UI file, no stock imagery, no toast system, no Enhance.
>
> **Two of the eleven do apply**, plus one I found myself that is worse than
> anything on the list. Section 4.

---

## 1. Current routes

| Route | Type | Status |
|---|---|---|
| `/` | Studio (client) | Real, working |
| `/engine-check` | Phase 2 harness | Real, but internal — should not ship |
| `/api/models`, `/api/still`, `/api/generations*`, `/api/blob/[key]` | REST | Real, integration-tested |

## 2–3. Every control, and what it actually does

| Control | On click | Verdict |
|---|---|---|
| Prompt textarea | Local state; ⌘↵ submits | **Real** |
| 3 example prompts | Fills the prompt | **Real** |
| Model cards (2) | Sets `model` | **Real control, fake second option — see §4** |
| Camera dropdown → 13 presets | Sets `motion`; drives actual render maths | **Real** |
| Duration slider 4–30s | Sets frame count; changes output length | **Real** |
| Aspect ratio (6) | Changes encoded dimensions | **Real** |
| Resolution (3) | Changes encoded dimensions | **Real** |
| Bitrate (2) | Passed to `VideoEncoder`; 1.7× measured size delta | **Real** |
| Spec line | Computed from the same functions the encoder uses | **Real** |
| Generate | `POST /api/generations` → pipeline | **Real** |
| Stage progress | `run.stage`/`run.progress` from the actual pipeline | **Real** |
| Download | `href = generation.outputUrl` (stored artifact) | **Real** |
| Reuse settings | Loads that job's exact params | **Real** |
| Try again | `POST .../retry` → new row, `retryOf` set | **Real** |
| History card / delete | Select; `DELETE /api/generations/:id` | **Real** |
| Engine + storage badges | From `/api/models` | **Real** |

**Dead controls: none. Simulated interactions: none.**

## 4. What is actually wrong

**(a) `Slate Turbo` is a fake model — my own bug, and the worst thing here.**
Tested against the upstream with a fixed seed:

```
flux  -> 200, 25597 bytes, 3.13s
turbo -> 200, 25597 bytes, 0.59s
same seed, both models -> byte-identical files (16065 bytes each)
```

The `model` parameter is ignored upstream. So the selector offers two options
that produce identical output, and the copy claims "roughly twice as fast,
slightly softer detail" — an unverified performance claim about a model that
does not exist. This is exactly a fake setting and it must go.

**(b) Create / Edit / Motion are not distinct workflows.** True. Only Create
exists. §8–10.

**(c) Stage copy overstates the engine.** "Moving camera" can be read as a model
moving a camera through a 3-D scene. It is a 2-D affine transform with eased
keyframes over a generated still. Accurate, but it should say so.

**(d) Upstream reliability, found while testing.** 2 of 6 still requests
returned HTTP 500 after ~44s under burst. Handled (`still_unavailable` +
Retry), but a judge clicking twice quickly can see a failure. Needs a real
mitigation, not just an error state.

**(e) `/engine-check` ships to production.** Internal harness, publicly routable.

## 5. Reusable as-is
`lib/engine/*`, `lib/generation/*`, `lib/store/*`, `lib/providers/*`, all routes,
`useStudio` pipeline, `primitives.tsx`, `Stage` states, `HistoryRail`, design tokens.
**The entire backend and the whole generate pipeline survive the redesign.**

## 6. To redesign
`TopBar` (needs global nav + workflow tabs), `Composer` (needs media input, preset
card, denser chip settings), `Stage` (needs a discovery surface for the empty
state), `StudioShell` (needs routing across workflows).

## 7. Final information architecture

```
/                 Studio
                    Create Video   (default, real today)
                    Still Image    (real — /api/still already does this)
                    Motion Library (real — 13 presets, live preview)
/assets           Every generation, grid, filters, download
/developers       Honest docs for the REST API that genuinely exists
```

Global nav mirrors the reference's compact horizontal bar; workflow tabs sit at
the top of the composer exactly as in the screenshots.

## 8. Create Video
Media input (optional reference still) → prompt → model → camera move → duration /
aspect / resolution / bitrate → Generate → staged progress → result → history.
Already real; gains the preset card, denser chip row, and a discovery empty state.

## 9. Edit Video — **NOT BUILDING**
Higgsfield's Edit takes an uploaded video and relights/restyles/reframes it. That
needs a video-to-video diffusion model. We have no such provider and no budget for
one. There is no honest version of this, so the tab does not exist. Shipping it as
a disabled tab or a waitlist is still a dead control.

## 10. Motion Control — **reframed, not faked**
Higgsfield's Motion Control transfers motion from a reference video onto a
character image. We cannot do that.

What we *can* do honestly is the other meaning of the term, and it is
Higgsfield's actual signature: **camera** control. A **Motion Library** surface
that browses all 13 presets, plays a real rendered preview of each, explains the
move, and loads it into the composer. Every preview is genuinely produced by our
engine. Named accurately as "Motion Library", never "Motion Control", so it
cannot be mistaken for motion transfer.

## 11–12. Other pages

| Page | Supports | Honest? |
|---|---|---|
| **Still Image** | Prompt → real AI still → download. Uses the existing proxy. | Yes |
| **Assets** | Real history: grid, status filter, download, delete | Yes |
| **Developers** | Documents endpoints that exist, with real curl examples | Yes |
| ~~Explore~~ | Would need other users' content. We have none. | **No — cut** |
| ~~Audio / API product / Pricing / Credits~~ | No provider, no billing | **No — cut** |

## 13. Not exposing
Edit Video · motion transfer · Enhance/prompt rewriting · upscale · relight ·
lipsync · draw-to-video · audio · credits & pricing · social feed · accounts.
Each would require a provider or a system we do not have.

## 14. Visual system
Keep the established direction: warm near-black, tungsten-amber reserved for
state, near-white primary action, hairline structure, monospace for every
technical value. Add from the reference: **workflow tabs**, **preset hero card**,
**compact chip settings row**, **mega-menu nav**, **discovery empty state**.
Reject from the reference: the acid-yellow CTA, credit counters, upgrade nags.

## 15. Responsive
≥1440 three columns · 1024–1440 composer + stage, history as filmstrip ·
<1024 stage over composer · <768 single column, history in a sheet, tabs scroll.

## 16. Motion
Unchanged and already built: 120–180ms ease-out, crossfade + 4px rise, real
stage-driven progress, `prefers-reduced-motion` honoured. Add: tab underline
slide, mega-menu fade, preset preview on hover.

## 17. Risks and priority

| # | Risk | Mitigation |
|---|---|---|
| 1 | Fake Turbo model | **Remove now.** Ship one model until a second is proven distinct. |
| 2 | Upstream 500s under burst | Retry with backoff in `/api/still`, plus a second image provider behind the same interface |
| 3 | Schema still unapplied | Blocks durable persistence in production |
| 4 | Nothing pushed to GitHub | Blocks the deliverable entirely |
| 5 | Scope: 3 new surfaces in the time left | Build in priority order below; each ships complete or not at all |

**Priority:** 1) remove fake model + fix stage copy + drop `/engine-check`
2) nav + workflow tabs + composer density 3) Motion Library 4) Assets
5) Still Image 6) Developers.

Items 1 and 2 are the quality bar. Items 3–6 are additive and each can be cut
without leaving a hole.
