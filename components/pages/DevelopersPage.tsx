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
      className="absolute right-2 top-2 rounded border border-line bg-ground/85 px-2 py-1
        text-[10px] text-ink-3 transition-colors duration-150 hover:border-line-strong hover:text-ink"
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

function Block({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="tabular overflow-x-auto rounded-card border border-line bg-surface p-3
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
    method: 'GET', path: '/api/generations',
    summary: 'History for the calling device, newest first. Cursor paginated.',
    detail: 'Scoped by a signed httpOnly cookie. A device only ever sees its own rows.',
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
    summary: 'Delete a generation owned by the calling device.',
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
  GET: 'border-success/40 text-success',
  POST: 'border-accent-dim text-accent',
  PATCH: 'border-line-strong text-ink-2',
  DELETE: 'border-danger/40 text-danger',
}

export function DevelopersPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-7 sm:px-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Developers</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-3">
            Slate&apos;s REST API, documented from the endpoints that actually ship. Every route
            below is live in this deployment — nothing here is aspirational. Requests are scoped
            by a signed httpOnly cookie, so keep a cookie jar between calls.
          </p>
        </header>

        <section id="engine" className="mb-7 rounded-card border border-line bg-surface p-4">
          <h2 className="text-sm font-medium">How a clip is actually made</h2>
          <p className="mt-2 text-xs leading-relaxed text-ink-3">
            Slate is honest about its pipeline. A prompt produces a real AI still through an image
            model. That frame is then driven by a real camera move — an eased affine transform
            computed per frame — and encoded to genuine H.264 in your browser via WebCodecs, at the
            exact duration, aspect ratio, resolution and bitrate you chose.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink-3">
            It is <span className="text-ink-2">not</span> text-to-video diffusion, and Slate never
            claims it is. The provider layer is an interface: a diffusion backend drops in behind
            the same contract without changing a single route.
          </p>
        </section>

        <div className="flex flex-col gap-5">
          {ENDPOINTS.map((e) => (
            <section key={e.method + e.path} className="rounded-card border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`tabular rounded border px-1.5 py-px text-[10px] font-medium ${TONE[e.method]}`}>
                  {e.method}
                </span>
                <code className="tabular text-sm text-ink">{e.path}</code>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-2">{e.summary}</p>
              {e.detail && <p className="mt-1.5 text-xs leading-relaxed text-ink-3">{e.detail}</p>}
              {e.request && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.09em] text-ink-4">Request</p>
                  <Block code={e.request} />
                </div>
              )}
              {e.response && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.09em] text-ink-4">Response</p>
                  <Block code={e.response} />
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
