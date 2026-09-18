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

## J. Provider strategy, fallback, and the Sora spike

*Revised 2026-09-18 after an OpenAI key became available for 1–2 real generations.*

### J.1 Research findings (verified against live docs, not training data)

| Question | Finding | Source confidence |
|---|---|---|
| Create | `POST /v1/videos` | High — consistent everywhere |
| Poll | `GET /v1/videos/{video_id}` → `status`, `progress` (0–100) | High |
| Statuses | `queued` → `in_progress` → `completed` \| `failed` | High |
| Download | `GET /v1/videos/{video_id}/content`, binary MP4, `variant=video\|thumbnail\|spritesheet` | High |
| **URL lifetime** | **Download valid ~1 hour after generation** | High — drives a hard design requirement |
| Models | `sora-2`, `sora-2-pro` | High |
| Image input | `input_reference` (JPEG/PNG/WebP), **must match target resolution** | High |
| Webhooks | `video.completed`, `video.failed` | High |
| `size` | `720x1280`, `1280x720`, `1024x1792`, `1792x1024` | Medium |
| `seconds` | **Disputed — see below** | **Low** |
| Price | sora-2 **$0.10/s** @720p · sora-2-pro $0.30/s @720p, $0.50/s @high-res | Medium |

**The `seconds` discrepancy, recorded rather than guessed at.** Three sources disagree:

- OpenAI's own guide page, as fetched: `"8"`, `"16"`, `"20"`
- Third-party docs and my prior knowledge: `4`, `8`, `12` for sora-2 (`10`, `15`, `25` for pro)
- The fetched page also returned Azure-flavoured sizes (`1920x1080`, `480x848`), which suggests the summariser blended Azure Foundry content into the OpenAI answer — so that page's values are **not trustworthy**

Resolution: **do not hardcode a guess.** A malformed request returns HTTP 400 *before any generation runs and therefore costs nothing*, and OpenAI's validation errors enumerate the accepted values. So the spike's first call is a deliberate zero-cost probe that makes the API tell us its own contract. Discovered values get written into `docs/PROVIDERS.md` and the provider's capability table.

### J.2 The decisive constraint

**The Sora API shuts down 2026-09-24.** Announced 2026-03-24; the consumer apps already went dark 2026-04-26; the deprecation table lists **no replacement**.

That is **six days** from now, and the day after this assignment is judged. A submitted product whose core feature dies within a week is a product-judgement failure, not a feature.

So Sora's role is settled and narrow:

> **Sora is a proving instrument for the abstraction, never the shipped default.**

- It runs **locally only**, for 1–2 recorded real generations
- `OPENAI_API_KEY` is **never set in Vercel** — production simply has no Sora provider configured, and the registry falls through to the free engine
- The recorded artifact and logs go in the repo as evidence the abstraction drives a real third-party video API
- The walkthrough states plainly why it was not shipped

This is the strongest available answer to "did you just build a toy?" — the abstraction is demonstrably real, and the decision not to ship it is the judgement being demonstrated.

### J.3 Provider interface

Two things the naive version of this gets wrong, both handled explicitly:

**(a) Execution location differs per provider.** The free engine renders in the browser; Sora and fal run server-side and are polled. The job record and state machine are identical either way — only the executor changes.

**(b) Our settings model is richer than Sora's.** We offer 6 aspect ratios × 3 resolutions × 4–30s. Sora offers 4 sizes and 3 durations. An abstraction that ignores this either crashes or silently lies about what it rendered. Hence `negotiate()`, which is a first-class interface method rather than an afterthought.

```ts
type ProviderId = 'cinematic' | 'sora' | 'fal'

interface ProviderCapabilities {
  id: ProviderId
  label: string                       // shown in the model selector
  execution: 'client' | 'server'      // (a)
  requiresKey: boolean
  configured: boolean                 // key present in THIS environment
  durations: number[]                 // discovered, not assumed
  sizes: string[]
  supportsReference: boolean
  sunsetAt?: string                   // sora: '2026-09-24' — surfaced in UI
  estimateCostUsd?(req: GenerationRequest): number
}

interface Negotiation {
  normalized: NormalizedRequest
  adjustments: Array<{               // (b) — never silent
    field: 'duration' | 'size' | 'aspectRatio' | 'resolution'
    requested: string
    actual: string
    reason: string
  }>
}

interface GenerationProvider {
  capabilities: ProviderCapabilities
  negotiate(req: GenerationRequest): Negotiation
  submit(req: NormalizedRequest): Promise<ProviderHandle>
  poll(h: ProviderHandle): Promise<ProviderState>
  fetchArtifact(h: ProviderHandle): Promise<{ stream: ReadableStream; contentType: string }>
  cancel?(h: ProviderHandle): Promise<void>
}
```

The registry resolves by id and **falls through to `cinematic` whenever a provider is unconfigured**, so an absent key degrades to the free engine instead of erroring. Adding fal.ai later means one new file plus one registry line.

### J.4 Two consequences that would bite later if ignored

**Artifacts must be re-hosted immediately.** Sora download URLs expire in ~1 hour. On `completed` the server streams the MP4 straight into Supabase Storage and persists *our* URL. If history pointed at OpenAI's URL, every Sora generation would 404 an hour later — and after the 24th, permanently.

**Polling without a background worker.** Vercel functions can't hold a long poll. `GET /api/generations/:id` performs a *poll-through*: if the record is server-executed, non-terminal, and its `provider_polled_at` is stale, it polls the provider inline, persists any transition, then responds. The client's existing status poll drives provider polling for free — no cron, no queue, no webhook endpoint required. Webhooks stay available as a later optimisation.

### J.5 Key handling — non-negotiable rules

1. `OPENAI_API_KEY` is read from `process.env` **only**, in a module marked `import 'server-only'`. It can never reach a client bundle.
2. Never committed. `.env*` is already gitignored; a unit test additionally greps the working tree for key-shaped strings and fails the suite on a hit.
3. Never logged. The provider's error path redacts `Authorization` and any `sk-`-prefixed token before anything is written or thrown.
4. Never sent anywhere but `api.openai.com`, enforced by an explicit host check in the client wrapper.
5. Never set in Vercel, per §J.2.
6. The user enters it directly into `.env.local` — never pasted into chat, a source file, or a shell command that lands in history.

### J.6 Cost control for the spike

sora-2 at $0.10/s is the only tier considered; `sora-2-pro` ($0.30–0.50/s) is excluded outright.

| Config | Cost |
|---|---|
| sora-2, shortest duration, `1280x720` | **$0.40** (if 4s is valid) / **$0.80** (if 8s is the floor) |
| Zero-cost 400 probe | **$0.00** |
| Two tests, worst case | **≤ $1.60** |

Guards: the spike script prints its own cost estimate and requires an explicit confirmation flag before spending; `sora-2-pro` and the high-res sizes are rejected in code; a hard per-run ceiling aborts above $1.00.

### J.8 Phase 2 findings — measured, not assumed

Verified in a real browser on 2026-09-18. These changed the design.

**The browser can never fetch the still directly.** Pollinations returns
`403 {"error":"Missing Turnstile token"}` whenever an `Origin` header is present,
but `200` with a real JPEG from a server-side request with no `Origin`.

```
server-side, no Origin   -> http=200  29,134 bytes  image/jpeg  3.8s
browser-like, w/ Origin  -> http=403  {"error":"Missing Turnstile token"}
```

So the pipeline is **server-fetches-still, client-renders-and-encodes**: the API route
retrieves the image, persists it to Storage, and hands the client a same-origin URL.
This also removes canvas tainting, since the image is no longer cross-origin. Had this
surfaced in Phase 3 instead of Phase 2, the provider would have been built against an
endpoint the browser cannot reach.

**Encoder results** (4s @ 30fps, H.264 `avc1.640034`, WebCodecs):

| Case | Dimensions | Size | Encode time |
|---|---|---|---|
| 16:9 720p standard | 1280×720 | 0.84 MB | 0.6 s |
| 16:9 720p **high** | 1280×720 | **1.34 MB** | 0.6 s |
| 9:16 720p standard | 720×1280 | 0.62 MB | 0.6 s |
| 21:9 480p standard | 1120×480 | 0.63 MB | 0.5 s |
| 16:9 1080p high | 1920×1080 | 2.49 MB | 1.4 s |
| Real photo, 720p standard | 1280×720 | 0.96 MB | 2.0 s |
| Real photo, 720p **high** | 1280×720 | **1.64 MB** | 1.4 s |

Every requested dimension came back exactly. The bitrate tiers are genuinely distinct —
1.7× more data on identical content — so that control is real, not decorative.

**Measured bitrate lands ~60% of target.** Expected: a slow camera move across a still
has enormous frame-to-frame redundancy, so VBR spends well under the ceiling. The
setting is a ceiling, not a quota, and the UI should describe it that way rather than
promising an exact number.

**Risk 6 is retired.** 1080p encodes in 1.4s, far inside budget, so the 30s ceiling
stands and no resolution tier needs dropping.

---

### J.7 Default provider — unchanged

`CinematicProvider` remains the shipped default, exactly as approved: real AI still (Pollinations FLUX — verified working, keyless, watermark-free, 3.1s) → real eased camera move → real H.264 encode honouring all four settings. It has no key, no quota, no sunset date, and it is what the judge's live link will run on.
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
| 2.5 | **Sora validation spike** *(local only)* | 0.5 | Zero-cost 400 probe resolves the `seconds` contract; 1 real generation verified end to end; artifact + findings committed to `docs/PROVIDERS.md`; `OPENAI_API_KEY` confirmed absent from Vercel |
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
| 10 | **Sora API dies 2026-09-24, six days out** | High | Never the deployed default; `OPENAI_API_KEY` is never set in Vercel; registry falls through to the free engine when unconfigured. Product is unaffected on the 25th. |
| 11 | **`seconds` contract is genuinely uncertain** | Medium | Resolved by a zero-cost 400 probe before any paid call, not by guessing. Discovered values recorded in `docs/PROVIDERS.md`. |
| 12 | **Sora download URLs expire in ~1 hour** | High | Artifact streamed into Supabase Storage on completion; history always points at our URL, never OpenAI's. |
| 14 | **Image host blocks browser-origin requests** | High | **Already hit and solved in Phase 2.** Pollinations 403s any request carrying an `Origin`. Stills are fetched server-side and re-served same-origin, which also avoids canvas tainting. Any replacement image provider must be assumed to behave the same way. |
| 13 | **API key leaking into repo, logs, or client bundle** | High | `server-only` module boundary, redaction in error paths, host allow-list, `.env*` gitignored, plus a unit test that greps the tree for key-shaped strings and fails the suite. |

---

## Decisions — resolved 2026-09-18, before Phase 1

1. **Product name: Slate.** Clapperboard. Used in the header, repo, README and walkthrough.
2. **Camera-motion presets: included** as a first-class generation control, promoted into MUST HAVE.
3. **Accounts:** GitHub → Supabase → Vercel, walked through one at a time during Phase 0.
4. **Budget: free engine, no spend.** `CinematicProvider` is the default. `FAL_KEY` remains a
   drop-in upgrade behind the same interface, reversible at any point including post-submission.
