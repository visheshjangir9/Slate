'use client'

import { useState } from 'react'

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1400)
        } catch { /* clipboard unavailable; the text is selectable anyway */ }
      }}
      className="absolute right-2 top-2 rounded-[3px] border border-line bg-ground/85 px-2 py-1
        text-[10px] text-ink-2 transition-colors duration-150 hover:border-line-strong hover:text-ink"
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

function Block({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="tabular overflow-x-auto rounded-[4px] border border-line bg-ground p-3
        text-[11.5px] leading-relaxed text-ink-2">{code}</pre>
      <Copy text={code} />
    </div>
  )
}

interface Endpoint {
  method: string
  path: string
  summary: string
  detail?: string
  request?: string
  response?: string
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'POST', path: '/api/auth/signup',
    summary: 'Create an account and start a session.',
    detail: 'Creates a Supabase Auth user and sets httpOnly session cookies. Every generation route below requires this session.',
    request: `curl -s -X POST https://YOUR_HOST/api/auth/signup -c cookies.txt -b cookies.txt \\
  -H 'Content-Type: application/json' \\
  -d '{ "email": "you@studio.com", "password": "at-least-8-chars" }'`,
    response: `{ "user": { "id": "…", "email": "you@studio.com" }, "adopted": 2 }`,
  },
  {
    method: 'POST', path: '/api/auth/login',
    summary: 'Sign in with email and password.',
    detail: 'Same body as signup. Returns 401 invalid_credentials on a mismatch.',
  },
  {
    method: 'GET', path: '/api/auth/session',
    summary: 'Who is signed in. Returns { "user": null } when signed out.',
  },
  {
    method: 'POST', path: '/api/auth/logout',
    summary: 'Revoke the session server-side and clear the cookies.',
  },
  {
    method: 'GET', path: '/api/models',
    summary: 'Catalogue: models, camera moves, allowed settings, engine and storage status.',
    request: `curl -s https://YOUR_HOST/api/models`,
    response: `{
  "models": [
    { "id": "slate-cinematic-1", "label": "Slate Cinematic 1",
      "providerId": "cinematic", "badge": "TOP", "available": true }
  ],
  "motions": [ { "id": "dolly_in", "label": "Dolly In", "badge": "TOP" } ],
  "settings": {
    "aspectRatios": ["21:9","16:9","4:3","1:1","4:5","9:16"],
    "resolutions": ["480p","720p","1080p"],
    "bitrates": ["standard","high"],
    "duration": { "min": 4, "max": 30 }
  },
  "persistence": { "durable": true, "adapter": "supabase" }
}`,
  },
  {
    method: 'POST', path: '/api/generations',
    summary: 'Create a generation. Validates, negotiates with the provider, persists as queued.',
    detail: 'Returns 400 with field-level messages when a setting is out of range.',
    request: `curl -s -X POST https://YOUR_HOST/api/generations \\
  -H 'Content-Type: application/json' \\
  -c cookies.txt \\
  -d '{
    "prompt": "a lighthouse in a storm at dusk",
    "model": "slate-cinematic-1",
    "motion": "crane_up",
    "durationS": 8,
    "aspectRatio": "16:9",
    "resolution": "1080p",
    "bitrate": "high"
  }'`,
    response: `{
  "generation": {
    "id": "13f4281a-…", "status": "queued", "progress": 0,
    "motion": "crane_up", "seed": 2059598229,
    "provider": "cinematic", "adjustments": []
  },
  "execution": "client"
}`,
  },
  {
    method: 'POST', path: '/api/generations/:id/render',
    summary: 'Run a server-executed job to completion: LTX-2 video or GPT Image.',
    detail: 'Used when create returned "execution": "server". Writes each stage to the row as it happens and only marks the job completed once the file is in Slate storage. Model "gpt-image-1" produces a JPEG cropped to the requested aspect ratio.',
    request: `curl -s -X POST -b cookies.txt https://YOUR_HOST/api/generations/GENERATION_ID/render`,
    response: `{ "generation": { "status": "completed", "outputUrl": "https://…/GENERATION_ID.jpg",
  "adjustments": [ { "field": "size", "requested": "9:16", "actual": "864×1536" } ] } }`,
  },
  {
    method: 'GET', path: '/api/generations',
    summary: 'History for the caller, newest first. Cursor paginated.',
    detail: 'Scoped to the signed-in account. Signed-out requests get 401 auth_required; nobody sees rows they do not own.',
    request: `curl -s -b cookies.txt 'https://YOUR_HOST/api/generations?limit=20'`,
    response: `{ "generations": [ { "id": "…", "status": "completed", "outputUrl": "…" } ],
  "nextCursor": null }`,
  },
  {
    method: 'GET', path: '/api/generations/:id',
    summary: 'Single job. This is the status-poll target.',
    detail: 'Also sweeps the job to failed if it stopped heart-beating for more than 90s.',
    request: `curl -s -b cookies.txt https://YOUR_HOST/api/generations/GENERATION_ID`,
  },
  {
    method: 'PATCH', path: '/api/generations/:id',
    summary: 'Apply a lifecycle event: start, progress or fail.',
    detail: 'Every transition passes through the state machine. Illegal moves return 409, never a silent write.',
    request: `curl -s -X PATCH https://YOUR_HOST/api/generations/GENERATION_ID \\
  -H 'Content-Type: application/json' -b cookies.txt \\
  -d '{ "event": "progress", "stage": "encode", "progress": 60 }'`,
    response: `// illegal transition
{ "error": { "code": "not_running",
             "message": "Cannot report progress while queued" } }`,
  },
  {
    method: 'POST', path: '/api/generations/:id/artifact',
    summary: 'Upload the finished render. Marks the job completed.',
    detail: 'multipart/form-data with a "video" file and an optional "poster". 50MB limit.',
    request: `curl -s -X POST https://YOUR_HOST/api/generations/GENERATION_ID/artifact \\
  -b cookies.txt \\
  -F 'video=@clip.mp4;type=video/mp4' \\
  -F 'poster=@poster.jpg;type=image/jpeg'`,
  },
  {
    method: 'POST', path: '/api/generations/:id/retry',
    summary: 'Clone the parameters into a new job.',
    detail: 'Creates a NEW row with retryOf set. The original stays, so history is an honest record.',
    request: `curl -s -X POST -b cookies.txt https://YOUR_HOST/api/generations/GENERATION_ID/retry`,
  },
  {
    method: 'DELETE', path: '/api/generations/:id',
    summary: 'Delete a generation the caller owns.',
    request: `curl -s -X DELETE -b cookies.txt https://YOUR_HOST/api/generations/GENERATION_ID`,
  },
  {
    method: 'GET', path: '/api/still',
    summary: 'Generate a single frame and stream it back as JPEG.',
    detail: 'Exists because the upstream rejects browser-origin requests: it returns 403 "Missing Turnstile token" whenever an Origin header is present. Proxying server-side also keeps the image same-origin, so a canvas reading it back is not tainted.',
    request: `curl -s 'https://YOUR_HOST/api/still?prompt=a%20lighthouse%20at%20dusk&width=1280&height=720&seed=42' \\
  -o frame.jpg`,
  },
  {
    method: 'POST', path: '/api/uploads/reference',
    summary: 'Store a reference image to animate instead of a generated still.',
    detail: 'multipart/form-data with an "image" file. JPEG, PNG or WebP, 10MB limit.',
    request: `curl -s -X POST https://YOUR_HOST/api/uploads/reference \\
  -b cookies.txt -F 'image=@frame.jpg;type=image/jpeg'`,
  },
]

const TONE: Record<string, string> = {
  GET: 'border-live/40 text-live',
  POST: 'border-signal/50 text-signal',
  PATCH: 'border-line-strong text-ink-2',
  DELETE: 'border-danger/45 text-danger',
}

const anchor = (e: Endpoint) => `${e.method}-${e.path}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')

export function DevelopersPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 pt-10 sm:px-6 lg:px-10">
      <header className="grid gap-6 border-b border-line pb-10 lg:grid-cols-[1fr_1fr] lg:items-end">
        <div>
          <p className="eyebrow text-signal">Developers</p>
          <h1 className="display display-l mt-3">The API behind <span className="serif-accent">every render.</span></h1>
        </div>
        <p className="max-w-xl text-[15px] leading-relaxed text-ink-2">
          Documented from the endpoints that ship. Every route below is live in this deployment. Requests are
          scoped to the signed-in account: sign in first and keep the cookie jar between calls.
        </p>
      </header>

      <div className="grid gap-10 pt-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Endpoints" className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-0.5">
            <a href="#engine" className="rounded px-2 py-1.5 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink">How output is made</a>
            {ENDPOINTS.map((e) => (
              <a key={anchor(e)} href={`#${anchor(e)}`}
                className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-ink-3 hover:bg-surface-2 hover:text-ink">
                <span className={`tabular w-11 shrink-0 text-[10px] ${TONE[e.method].split(' ')[1]}`}>{e.method}</span>
                <span className="tabular truncate">{e.path}</span>
              </a>
            ))}
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-4">
          <section id="engine" className="scroll-mt-24 rounded-card border border-line bg-surface p-5">
            <h2 className="display display-s">How output is made</h2>
            <div className="mt-4 grid gap-4 text-[13px] leading-relaxed text-ink-2 md:grid-cols-3">
              <p><span className="font-semibold text-ink">Slate Cinematic 1.</span> A real AI still (or your image) driven by an
                eased camera transform computed per frame, encoded to H.264 in the browser via WebCodecs at the exact
                settings chosen. It is not text-to-video diffusion, and Slate never claims it is.</p>
              <p><span className="font-semibold text-ink">LTX-2 Pro.</span> Generative video from Lightricks, called server-side.
                The model animates the scene itself. Renders 4, 6 or 8 seconds; the MP4 is validated before the job completes.</p>
              <p><span className="font-semibold text-ink">GPT Image 1.</span> OpenAI image generation at its nearest native size,
                centre-cropped to your aspect ratio and stored as JPEG. No other model is ever substituted on failure.</p>
            </div>
          </section>

          {ENDPOINTS.map((e) => (
            <section key={anchor(e)} id={anchor(e)} className="scroll-mt-24 rounded-card border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`tabular rounded-[3px] border px-1.5 py-px text-[10px] font-medium ${TONE[e.method]}`}>{e.method}</span>
                <code className="tabular text-sm text-ink">{e.path}</code>
              </div>
              <p className="mt-2.5 text-[13px] leading-relaxed text-ink-2">{e.summary}</p>
              {e.detail && <p className="mt-1.5 text-xs leading-relaxed text-ink-3">{e.detail}</p>}
              {(e.request || e.response) && (
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {e.request && (
                    <div className="min-w-0">
                      <p className="eyebrow mb-1.5 text-ink-3">Request</p>
                      <Block code={e.request} />
                    </div>
                  )}
                  {e.response && (
                    <div className="min-w-0">
                      <p className="eyebrow mb-1.5 text-ink-3">Response</p>
                      <Block code={e.response} />
                    </div>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
