# Implementation Proposal — 8x Software Engineer Assignment

**Author:** visheshjangir9 · **Reference product:** higgsfield.ai · **Window:** 20h 38m remaining at time of writing (deadline 2026-09-19 06:46 UTC)

> Source of truth for scope is `docs/8x-assignment.pdf` (handwritten product analysis).
> This document turns that analysis into an executable build plan. It does not re-decide scope.

---

## A. Product concept

**A focused AI video studio built around exactly one journey, done to production quality.**

From the brief, verbatim:

> *"I am NOT trying to recreate entire Higgsfield platform, I am recreating ONE STRONG END-TO-END USER JOURNEY."*
> *"Depth over breadth. One complete workflow is more valuable than many incomplete features."*

That is the whole thesis, and everything below serves it.

Higgsfield's actual identity is **camera-first generation**: you don't just describe a scene, you choose a named cinematographer's move — Dolly In, Crash Zoom, Orbit, Crane Up — and the system renders a clip that honours that motion. Their own marketing leads with 50+ camera presets, not with model names. So the clone keeps the camera as the hero control and drops everything else.

**What we are NOT building** (from the brief): every Higgsfield feature, a full platform clone, anything that doesn't contribute to the core workflow. No Explore feed, no Audio, no MCP, no Motion Designer, no team plans, no billing.

---

## B. Core user journey

Straight from the brief, unchanged:

```
Prompt → Model → Settings → Generate → Loading → Result → History
```

Expanded to the eight steps in the notes:

1. User wants to create an AI video
2. User enters a prompt
3. User optionally adds an image reference
4. User chooses model + settings
   - (a) Duration — 4s → 30s
   - (b) Aspect ratio — 21:9 → 9:16 (6 ratios)
   - (c) Resolution — 480p → 1080p (3 tiers)
   - (d) Bitrate — High (less compression, larger) / Standard (more compression, smaller)
5. User clicks Generate
6. System processes the request
7. User receives the generated video
8. User can view / save / download it

**Critical behaviour from the brief:** while generation runs, *"we can still see the history, with prompt, everything works as before, and video is generating in bg."* The app must never lock up during generation. History stays browsable, a second generation can be queued, nothing blocks.

---

## C. Exact screens and components

One screen does the work, matching the Screen-1 sketch (Header / Sidebar / Prompt box / Model selector / Settings / Reference upload / Generate).

### Layout — `/` (Studio)

```
┌──────────────────────────────────────────────────────────────┐
│ HEADER   logo · engine badge · theme toggle                  │
├────────┬─────────────────────────────────────┬───────────────┤
│        │                                     │               │
│ SIDE   │         STAGE                       │   HISTORY     │
│ BAR    │  (player / progress / empty state)  │   RAIL        │
│        │                                     │               │
│ nav    ├─────────────────────────────────────┤  past gens    │
│        │  COMPOSER                           │  status dot   │
│        │  prompt · reference · model ·       │  thumbnail    │
│        │  settings · Generate                │  prompt       │
└────────┴─────────────────────────────────────┴───────────────┘
```

Mobile: single column — Stage on top, Composer below, History as a bottom sheet.

### Component inventory

| Component | Responsibility | Key states |
|---|---|---|
| `AppShell` | Header, sidebar, responsive frame | — |
| `PromptBox` | Autosizing textarea, char counter, ⌘↵ submit | empty, typing, too-long, invalid |
| `ModelSelector` | Dropdown, per-model info + `TOP`/`NEW` badges, selected model echoed into composer | closed, open, selected, unavailable |
| `MotionPicker` | Camera-move presets with looping preview tiles | none/selected |
| `SettingsPanel` | Duration slider, aspect-ratio picker, resolution tier, bitrate toggle | default, dirty, constrained |
| `ReferenceUpload` | Drag-drop / click, preview, remove, type+size validation | empty, dragging, uploading, ready, rejected |
| `GenerateButton` | Primary action; disabled reasons surfaced on hover | idle, disabled, submitting |
| `Stage` | Empty state / progress / player / error | empty, generating, completed, failed |
| `VideoPlayer` | Poster, controls, loop, download, aspect-correct | loading, ready, error |
| `ProgressPanel` | Staged progress with real substeps, elapsed timer, cancel | queued→completed |
| `HistoryRail` | Reverse-chron list, click to restore, status dots, delete | empty, loading, populated, error |
| `Toast` | Non-blocking success/error feedback | — |

### The four screen states that get designed properly

1. **Empty** — first visit, no history. Not a blank box: a short "what this does" line, three one-click example prompts that fill the composer. This is the first thing a judge sees.
2. **Generating** — stage shows real staged progress (not a fake spinner), composer stays live, history stays browsable.
3. **Completed** — player with the clip, the exact settings used, download button, "use these settings again".
4. **Failed** — plain-language cause, a Retry that actually re-runs the same job, and the prompt preserved.

---

## D. Must-have / nice-to-have / out-of-scope

Taken from the brief's own MVP table.

### MUST HAVE — ships or the assignment fails
- Prompt input
- Model selection (with badges)
- Settings: duration, aspect ratio, resolution, bitrate
- Generate action
- Loading state
- Result (playable + downloadable)
- History (persisted)
- Responsive UI
- Deployment (public, works signed-out)

### Approved addition to MUST HAVE
- **Camera-motion preset** as a first-class generation parameter. *(Approved 2026-09-18.)*

  Rationale: it is Higgsfield's actual differentiator, the render engine needs a motion parameter regardless, and it costs ~40 minutes. Without it this is a generic video generator; with it, it reads as a Higgsfield clone. Flagging rather than adding silently.

### NICE TO HAVE — only if the clock allows
- Multiple generation modes · advanced editing · extra animation · more models · advanced history filters · extra settings
- Share link for a single generation
- Keyboard shortcuts

### NOT BUILDING
- Every Higgsfield feature · full platform clone · anything not contributing to the core workflow
- **Auth / login.** Deliberate: the brief requires the live link to work for someone *not signed in as you*. A signup wall is the single biggest risk to that. History is scoped to an anonymous `device_id` cookie — persistent, zero-friction, no auth dependency.

---

## E. UX principles

1. **Never block on generation.** Async from the first line of code. Composer and history stay interactive.
2. **Every state is designed.** Empty, loading, success, failure, validation, offline. No unstyled flashes, no dead ends.
3. **Honest progress.** Progress reflects real pipeline substeps, never a fake timer.
4. **Failure is recoverable.** Every error names a cause and offers a next action. The prompt is never lost.
5. **Settings mean something.** Every control visibly changes the output file. No decorative knobs.
6. **Fast perceived performance.** Optimistic history insert, skeletons, poster frames before video loads.
7. **Responsive, not merely "not broken".** Desktop three-column, tablet two, mobile single + sheet.
8. **Restraint.** Dark cinematic surface, one accent, generous spacing, motion under 200ms.

---

## F. Technical architecture

```
Browser
  ├─ Studio UI (React 19 / Next 15 App Router, TS strict, Tailwind)
  ├─ Render worker  ─ camera engine → canvas frames → WebCodecs H.264 → MP4
  └─ polls job status

Next.js server (Vercel)
  ├─ /api/generations       validate → persist → dispatch
  ├─ Provider registry      CinematicProvider | FalProvider
  └─ Supabase client        Postgres + Storage

Supabase
  ├─ Postgres   generations table
  └─ Storage    outputs/ (mp4 + poster), references/
```

**Stack:** Next.js 15 (App Router) · TypeScript strict · Tailwind v4 · Zod validation · Supabase (Postgres + Storage) · Vercel.

### The one architectural decision that needs explaining

**Frames are rendered and encoded in the browser, not on the server.**

Why:
- A real H.264 encode honours **duration, aspect ratio, resolution and bitrate exactly** — all four settings from the brief become genuinely functional rather than cosmetic.
- Zero marginal cost and no serverless CPU limit, cold start, or ffmpeg binary-size problem on Vercel.
- Encoding is per-user and embarrassingly parallel; the edge is the right place for it.

The job record, validation, state transitions, storage and history all remain server-side and authoritative — so the pipeline in the brief (*validate → create job → send to service → track status → store result*) is real, not simulated.

**Handled downside:** if the tab closes mid-render the job stalls. A job in `rendering` with no heartbeat for 90s is swept to `failed` with a working Retry. Documented, not hidden.

**Fallback chain:** WebCodecs (MP4/H.264) → MediaRecorder (WebM) → server-side still + error. All three produce a real, downloadable file.

---

## G. Database schema

```sql
create type generation_status as enum ('queued','generating','completed','failed');

create table generations (
  id               uuid primary key default gen_random_uuid(),
  device_id        text        not null,              -- anon owner, from signed cookie
  prompt           text        not null check (char_length(prompt) between 3 and 2000),
  model            text        not null,
  motion           text        not null default 'static',
  duration_s       int         not null check (duration_s between 4 and 30),
  aspect_ratio     text        not null,              -- '21:9','16:9','4:3','1:1','4:5','9:16'
  resolution       text        not null,              -- '480p','720p','1080p'
  bitrate          text        not null,              -- 'standard' | 'high'
  reference_url    text,
  seed             bigint      not null,
  status           generation_status not null default 'queued',
  progress         int         not null default 0 check (progress between 0 and 100),
  stage            text,                              -- 'image' | 'render' | 'encode' | 'upload'
  output_url       text,
  poster_url       text,
  file_bytes       bigint,
  error_code       text,
  error_message    text,
  provider         text        not null default 'cinematic',
  heartbeat_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create index generations_device_created_idx on generations (device_id, created_at desc);
create index generations_stale_idx on generations (status, heartbeat_at)
  where status in ('queued','generating');
```

Row Level Security on, with access scoped by `device_id`; all writes go through the server using the service role. Storage buckets: `outputs` (public read), `references` (public read, 10MB cap).

---

## H. API endpoints

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/models` | Model catalogue + badges + capabilities (drives the selector) |
| `POST` | `/api/generations` | Validate (Zod) → insert `queued` → return job. **201** |
| `GET` | `/api/generations` | History, cursor-paginated, scoped to device |
| `GET` | `/api/generations/:id` | Single job — the status-poll target |
| `PATCH` | `/api/generations/:id` | Client reports progress/stage + heartbeat |
| `POST` | `/api/generations/:id/complete` | Attach rendered artifact → `completed` |
| `POST` | `/api/generations/:id/fail` | Record cause → `failed` |
| `POST` | `/api/generations/:id/retry` | Clone params into a fresh `queued` job |
| `DELETE` | `/api/generations/:id` | Remove job + storage objects |
| `POST` | `/api/uploads/reference` | Signed upload URL for reference images |

Cross-cutting: Zod on every body, rate limit per device on POST, consistent `{ error: { code, message } }` envelope, no `500` without a logged cause.

---

## I. Generation workflow / state machine

The brief's state machine, with the pipeline substages inside `generating`:

```
        ┌──────────┐
        │  queued  │◄──────────── retry ──────────┐
        └────┬─────┘                              │
             │ client picks up job                │
             ▼                                    │
      ┌─────────────┐                             │
      │ generating  │                             │
      │  image  ~3s │  fetch still from provider  │
      │  render ~2s │  camera move → frames       │
      │  encode ~3s │  WebCodecs → MP4            │
      │  upload ~2s │  → Supabase Storage         │
      └──┬───────┬──┘                             │
         │       │                                │
    ok   │       │ error / stale heartbeat        │
         ▼       ▼                                │
   ┌───────────┐ ┌────────┐                       │
   │ completed │ │ failed ├───────────────────────┘
   └───────────┘ └────────┘
```

Rules:
- Transitions are validated server-side; illegal moves are rejected, not silently applied.
- `completed` and `failed` are terminal — only Retry creates new work, as a **new row**, so history stays an honest record.
- Heartbeat every 5s during `generating`; >90s stale ⇒ swept to `failed` with `error_code: 'client_disconnected'`.
- Progress is derived from the real stage, never interpolated from a timer.

---

## J. Provider strategy and fallback

This is the highest-risk decision, so it was researched rather than assumed. **Findings are verified, not quoted from marketing:**

| Option | Verified result | Verdict |
|---|---|---|
| **fal.ai** (Kling/Veo/Seedance) | Real video diffusion, but **$10 minimum top-up** — per-clip pricing is unreachable below it | Blocked on budget |
| Replicate | Requires card on file | Blocked |
| "Free video API" vendors | Trial credits with short expiry, or wrappers. Nothing dependable for a live judged link | Rejected |
| **Pollinations** (`model=flux`) | **Tested live: HTTP 200, 768×432 JPEG, 3.1s, keyless, no watermark** | **Selected** |
| Cloudflare Workers AI (FLUX schnell) | Genuinely free ~10k req/day, no card, needs a free account | Selected as secondary |

**Conclusion: there is no free, reliable text-to-video API.** So rather than fake a diffusion model or gate the demo behind a payment, the video is *actually produced*:

### `CinematicProvider` (default, free, zero-key)
1. Prompt → a real AI still image (Pollinations FLUX — verified above).
2. Still → a real camera move: time-varying affine transform with eased keyframes (dolly, pan, tilt, orbit, crash zoom, crane, handheld), plus subtle motion blur, grain and vignette.
3. Frames → a real H.264 MP4 at the chosen duration, aspect ratio, resolution and bitrate.

The output is a genuine downloadable MP4. It is **not** text-to-video diffusion, and the UI will say so plainly — the engine is labelled in the header and in each model's description. Claiming otherwise would be the "fake experience" we were told to avoid; labelling it honestly makes it a real, working product with a stated technique.

### `FalProvider` (optional upgrade, env-gated)
Implements the identical interface. Setting `FAL_KEY` makes real diffusion models appear in the selector automatically — no other code changes. This is the replaceability requirement, and it means the $10 decision can be deferred or made after submission without a rewrite.

```ts
interface GenerationProvider {
  id: string
  models(): ModelDescriptor[]
  submit(job: GenerationJob): Promise<ProviderHandle>
  poll(handle: ProviderHandle): Promise<ProviderState>
  capabilities: { maxDuration: number; resolutions: string[]; needsKey: boolean }
}
```

**Fallback ladder:** Pollinations → Cloudflare FLUX → deterministic generated gradient frame. The pipeline always yields a playable artifact; it never dead-ends.

---

## K. Testing strategy

Proportionate to a 20h window — depth on the logic that can silently corrupt results, smoke coverage elsewhere.

**Unit (Vitest)**
- Zod validation: every setting boundary (4s/30s, all 6 ratios, 3 resolutions, both bitrates), rejection of out-of-range values
- State machine: every legal transition, and every illegal one rejected
- Camera engine: transform at t=0 and t=1 for each preset; easing monotonic; no frame outside bounds
- Aspect/resolution math: dimensions always even (H.264 requires it) for all 18 ratio×resolution combinations
- Provider adapter: success, timeout, malformed response

**Integration**
- API routes against a test schema: create → poll → complete → history; retry produces a new row; delete removes storage objects

**E2E (Playwright)** — the golden path, headless Chromium
- Load → empty state → fill prompt → pick model/settings → Generate → reaches `completed` → video element has a real `src` → download works → history shows the entry → reload persists it
- Failure path: forced provider error → `failed` → Retry → `completed`

**Manual matrix before submission**
- Chrome/Safari/Firefox desktop · iOS Safari · Android Chrome
- Signed-out in a private window against the **production URL** (the brief's explicit requirement)
- Throttled to Fast 3G to verify loading states are real

---

## L. Deployment architecture

- **Vercel** — Next.js app, production domain, automatic deploys from `main`
- **Supabase** — Postgres + Storage, free tier
- **GitHub** — public repo including `.agent-logs/`

Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DEVICE_COOKIE_SECRET`, optional `FAL_KEY`.

Deploy early and often: a throwaway page goes live in **Phase 1**, so deployment is never an untested step at hour 19. Every phase ends with a push to production.

Pre-submission gate: production URL in a private window, mobile viewport, full generation completed end-to-end, repo public, `.agent-logs/` present.

---

## M. 24-hour execution plan

20h 38m remaining. ~19h of work, ~1.5h slack.

| # | Phase | Hours | Exit criteria |
|---|---|---|---|
| 0 | **Plan approval** | 0.5 | This document approved; accounts created |
| 1 | **Foundation + first deploy** | 1.5 | Next.js + Tailwind + design tokens; Supabase schema applied; **live URL responding** |
| 2 | **Camera + encode engine** | 3.0 | Canvas renderer, all motion presets, WebCodecs MP4, unit tests green. *Highest-risk item, built first.* |
| 3 | **Provider + API + persistence** | 2.5 | Provider interface, Pollinations impl, all endpoints, state machine, storage upload |
| 4 | **Studio UI** | 4.0 | Composer, model selector, settings, reference upload, stage, history rail — wired end to end |
| 5 | **States + polish** | 3.0 | Empty/loading/error/validation, responsive breakpoints, motion, poster frames |
| 6 | **Testing** | 1.5 | Unit + integration + E2E golden path green |
| 7 | **Production hardening** | 1.0 | Real-device matrix, throttled network, signed-out verification |
| 8 | **Buffer** | 1.5 | Absorbs overrun |
| 9 | **Walkthrough + submit** | 1.0 | ≤5min Loom, camera on, links submitted |

Commit after every phase, interleaved with the `.agent-logs/` entries the hooks are already producing.

---

## N. Risks and mitigations

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **WebCodecs unsupported on judge's browser** | High | Fallback ladder to MediaRecorder/WebM, then to a still. Capability-detected at load; engine badge reflects the active path. Verified on Safari before submission. |
| 2 | **Pollinations rate-limits or goes down mid-judging** | High | Cloudflare FLUX as second provider, deterministic gradient as last resort. Provider chosen per-request with timeout + failover, so a dead upstream degrades instead of erroring. |
| 3 | **Scope creep past the core journey** | High | The brief's NOT-BUILDING list is binding. Nice-to-haves only after Phase 7 passes. |
| 4 | **Deployment discovered broken late** | High | Deployed in Phase 1 and re-deployed every phase. Never a last-hour step. |
| 5 | **Client disconnects mid-render** | Medium | Heartbeat + 90s stale sweep → `failed` + working Retry. Explicitly handled, not hidden. |
| 6 | **Encoding too slow at 1080p/30s** | Medium | Frame budget capped; resolution tiers tuned so worst case stays under ~15s. Measured in Phase 2 — if it misses, the 30s ceiling drops and the UI says why. |
| 7 | **Supabase free-tier storage (1GB) fills** | Low | ~2MB/clip ⇒ hundreds of clips. Retention sweep for anonymous jobs >7 days. |
| 8 | **"Is this really AI video?" credibility challenge** | Medium | Met head-on: honest labelling in-product, technique explained in README and walkthrough, and a real diffusion path one env var away. Judged as engineering judgement under a real constraint, which it is. |
| 9 | **Time lost to accounts (Vercel/Supabase/GitHub)** | Medium | Done during Phase 0 in parallel with scaffolding. |

---

## Decisions — resolved 2026-09-18, before Phase 1

1. **Product name: Slate.** Clapperboard. Used in the header, repo, README and walkthrough.
2. **Camera-motion presets: included** as a first-class generation control, promoted into MUST HAVE.
3. **Accounts:** GitHub → Supabase → Vercel, walked through one at a time during Phase 0.
4. **Budget: free engine, no spend.** `CinematicProvider` is the default. `FAL_KEY` remains a
   drop-in upgrade behind the same interface, reversible at any point including post-submission.
