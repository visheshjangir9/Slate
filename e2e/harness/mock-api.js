/*
 * Slate MOCK API — end-to-end test harness. Injected only into the credential-free E2E build (e2e/run.sh), never into the app.
 *
 * Patches window.fetch before the app boots and answers every /api/* request
 * in the browser from local fixtures, so no request reaches the Next server,
 * Supabase or any provider. Media are the project's own static files.
 *
 *   - Signed in as qa@slate.test (Sign out / Sign in toggle it, per tab).
 *   - Generations persist in sessionStorage for the tab.
 *   - New jobs run a timed lifecycle: queued → generating (image, render,
 *     upload) → completed with a local file. Put "[fail]" in a prompt to see
 *     the failure state.
 */
(function () {
  if (window.__slateMock) return
  window.__slateMock = true
  var realFetch = window.fetch.bind(window)
  var KEY = 'slate_mock_db_v2'
  var OUT_KEY = 'slate_mock_signed_out'
  var MIN = 60 * 1000

  var ago = function (ms) { return new Date(Date.now() - ms).toISOString() }
  var base = {
    deviceId: 'user:mock-user', motion: 'static', durationS: 6, aspectRatio: '16:9', resolution: '720p',
    bitrate: 'standard', referenceUrl: null, seed: 7, status: 'completed', stage: null, progress: 100,
    outputUrl: null, posterUrl: null, fileBytes: null, errorCode: null, errorMessage: null, adjustments: [],
    heartbeatAt: null, retryOf: null,
  }
  function g(o) {
    var created = o.createdAt || ago(MIN)
    var x = Object.assign({}, base, { createdAt: created, updatedAt: created, completedAt: o.status === 'failed' ? null : created }, o)
    // Like the real image pipeline: a finished image is its own poster.
    if (x.model === 'gpt-image-1' && x.outputUrl && !x.posterUrl) x.posterUrl = x.outputUrl
    return x
  }

  function fixtures() {
    return [
      g({ id: 'fx-01', workflow: 'video', model: 'ltx-2-pro', provider: 'ltxv', createdAt: ago(12 * MIN),
        prompt: 'A narrow Tokyo side street after rain, neon signs reflected in deep puddles as a cyclist glides through with a clear umbrella.',
        outputUrl: '/media/videos/video-city.mp4', posterUrl: '/media/videos/posters/video-city.jpg', fileBytes: 3441289 }),
      g({ id: 'fx-02', workflow: 'image', model: 'gpt-image-1', provider: 'gpt-image', aspectRatio: '4:5', createdAt: ago(41 * MIN),
        prompt: 'Editorial street portrait of a young man in a black jacket outside a Paris café in light rain, soft overcast light.',
        outputUrl: '/explore/street-portrait.jpg', fileBytes: 2272409 }),
      g({ id: 'fx-03', workflow: 'motion', model: 'slate-cinematic-1', provider: 'cinematic', motion: 'dolly_in', durationS: 10,
        referenceUrl: '/media/videos/posters/camera-motion-landscape.jpg', createdAt: ago(2 * 60 * MIN),
        prompt: 'Café window portrait, slow push in', outputUrl: '/media/videos/camera-motion-landscape.mp4',
        posterUrl: '/media/videos/posters/camera-motion-landscape.jpg', fileBytes: 2704352 }),
      g({ id: 'fx-04', workflow: 'video', model: 'ltx-2-pro', provider: 'ltxv', status: 'failed', progress: 40, createdAt: ago(3 * 60 * MIN),
        prompt: 'A dark green 1970s coupe drifts through a tight hairpin on a wet mountain pass at dawn.',
        errorCode: 'provider_rate_limited', errorMessage: 'The video model is rate limiting us. Wait a moment, then retry.' }),
      g({ id: 'fx-05', workflow: 'image', model: 'gpt-image-1', provider: 'gpt-image', aspectRatio: '1:1', bitrate: 'high', createdAt: ago(26 * 60 * MIN),
        prompt: 'A matte ceramic cup on raw concrete, hard morning light, long shadow, minimal product still.',
        outputUrl: '/explore/ceramic-cup.jpg', fileBytes: 268705 }),
      g({ id: 'fx-06', workflow: 'video', model: 'ltx-2-pro', provider: 'ltxv', durationS: 8, resolution: '1080p', createdAt: ago(30 * 60 * MIN),
        referenceUrl: '/media/stills/hero-still-02.jpg',
        prompt: 'She stands still as desert dunes give way to snow-capped mountains; wind lifts the sand around her.',
        outputUrl: '/media/videos/hero-02.mp4', posterUrl: '/media/stills/hero-still-02.jpg', fileBytes: 17626926 }),
      g({ id: 'fx-07', workflow: 'motion', model: 'slate-cinematic-1', provider: 'cinematic', motion: 'orbit_left', aspectRatio: '21:9', durationS: 10,
        createdAt: ago(2 * 24 * 60 * MIN), prompt: 'Rain-soaked crossing at dusk, orbit left',
        outputUrl: '/media/videos/slate-hero.mp4', posterUrl: '/media/stills/hero-still-01.jpg', fileBytes: 4634228 }),
      g({ id: 'fx-08', workflow: 'image', model: 'gpt-image-1', provider: 'gpt-image', aspectRatio: '4:3', createdAt: ago(3 * 24 * 60 * MIN),
        prompt: 'A brutalist chapel at dawn, one shaft of light through a slit window.',
        outputUrl: '/explore/brutalist-chapel.jpg', fileBytes: 2280374 }),
      g({ id: 'fx-09', workflow: 'video', model: 'ltx-2-pro', provider: 'ltxv', durationS: 8, createdAt: ago(4 * 24 * 60 * MIN),
        prompt: 'A white running shoe on a concrete plinth in a rain-soaked neon street; water splashes across it in slow motion.',
        outputUrl: '/media/videos/hero-03.mp4', posterUrl: '/media/stills/hero-still-03.jpg', fileBytes: 21154653 }),
      g({ id: 'fx-10', workflow: 'image', model: 'gpt-image-1', provider: 'gpt-image', aspectRatio: '16:9', createdAt: ago(6 * 24 * 60 * MIN),
        prompt: 'A late-night American diner seen from the street, warm interior glow, empty booths, rain on the glass.',
        outputUrl: '/explore/diner-night.jpg', fileBytes: 2898499 }),
    ]
  }

  function load() {
    try { var raw = sessionStorage.getItem(KEY); if (raw) return JSON.parse(raw) } catch (e) {}
    return { seq: 1, gens: fixtures() }
  }
  function save(db) { try { sessionStorage.setItem(KEY, JSON.stringify(db)) } catch (e) {} }
  var db = load(); save(db)

  var IMAGE_OUT = { '4:5': '/explore/harbour-portrait.jpg', '9:16': '/explore/glass-canyon.jpg', '1:1': '/explore/ceramic-cup.jpg',
    '4:3': '/explore/sneaker-plinth.jpg', '16:9': '/explore/ridge-dawn.jpg', '21:9': '/explore/neon-rain.jpg' }
  var VIDEO_OUT = {
    video: [['/media/videos/hero-02.mp4', '/media/stills/hero-still-02.jpg', 17626926], ['/media/videos/video-city.mp4', '/media/videos/posters/video-city.jpg', 3441289]],
    motion: [['/media/videos/camera-motion-landscape.mp4', '/media/videos/posters/camera-motion-landscape.jpg', 2704352], ['/media/videos/slate-hero.mp4', '/media/stills/hero-still-01.jpg', 4634228]],
  }
  /** A mock result that says what it is: the prompt drawn on a flat frame. Never a project photo. */
  function mockImage(x) {
    var dims = { '21:9': [1344, 576], '16:9': [1344, 756], '4:3': [1200, 900], '1:1': [1024, 1024], '4:5': [896, 1120], '9:16': [756, 1344] }[x.aspectRatio] || [1024, 1024]
    var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
    var hue = 0; for (var i = 0; i < x.prompt.length; i++) hue = (hue * 31 + x.prompt.charCodeAt(i)) % 360
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + dims[0] + '" height="' + dims[1] + '" viewBox="0 0 ' + dims[0] + ' ' + dims[1] + '">' +
      '<rect width="100%" height="100%" fill="hsl(' + hue + ',18%,16%)"/>' +
      '<text x="48" y="80" fill="#ff8a3d" font-family="monospace" font-size="28">MOCK OUTPUT · QA harness · no provider called</text>' +
      '<text x="48" y="130" fill="#e9e4dc" font-family="sans-serif" font-size="30">' + esc(x.prompt.slice(0, 70)) + '</text>' +
      '<text x="48" y="' + (dims[1] - 48) + '" fill="#8a857d" font-family="monospace" font-size="22">' + esc(x.id + ' · ' + x.aspectRatio) + '</text></svg>'
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  }
  var isImage = function (model) { return model === 'gpt-image-1' || /^byok:[a-z]+:image:/.test(String(model)) }
  var isByokVideo = function (model) { return /^byok:[a-z]+:video:/.test(String(model)) }
  var providerOf = function (model) { if (String(model).indexOf('byok:') === 0) return model.split(':').slice(0, 2).join(':'); return model === 'gpt-image-1' ? 'gpt-image' : model === 'ltx-2-pro' ? 'ltxv' : 'cinematic' }

  /** Advance a mock job according to the time since it was created. */
  function tick(x) {
    if (x._vs && x.status === 'generating') {
      // Provider video: pending at the provider for 12s, then collected.
      var ve = Date.now() - x._vs, stamp = new Date().toISOString()
      if (ve < 12000) {
        var real = x.provider === 'byok:openai' ? Math.round((ve / 12000) * 100) : x.progress
        return Object.assign(x, { stage: 'render', progress: real, heartbeatAt: stamp, updatedAt: stamp })
      }
      if (ve < 14000) return Object.assign(x, { stage: 'upload', heartbeatAt: stamp, updatedAt: stamp })
      if (/\[fail\]/i.test(x.prompt)) return Object.assign(x, { status: 'failed', stage: null, _vs: null, providerJob: null, errorCode: 'byok_job_failed', errorMessage: 'The provider could not complete this video.', updatedAt: stamp })
      var vp = VIDEO_OUT.video[db.seq % 2]
      return Object.assign(x, { status: 'completed', stage: null, _vs: null, providerJob: null, outputUrl: vp[0], posterUrl: x.referenceUrl || null, fileBytes: vp[2], progress: 100, completedAt: stamp, updatedAt: stamp })
    }
    if (!x._t0 || x.status === 'completed' || x.status === 'failed') return x
    var el = Date.now() - x._t0, d = x._dur
    var now = new Date().toISOString()
    if (el < 900) return Object.assign(x, { status: 'queued', stage: null, progress: 0 })
    if (el < d) {
      var f = el / d
      var stage = isImage(x.model) ? (f < 0.8 ? 'image' : 'upload') : (f < 0.25 ? 'image' : f < 0.85 ? 'render' : 'upload')
      return Object.assign(x, { status: 'generating', stage: stage, progress: Math.round(f * 90), heartbeatAt: now, updatedAt: now })
    }
    if (/\[fail\]/i.test(x.prompt)) {
      return Object.assign(x, { status: 'failed', stage: null, errorCode: isImage(x.model) ? 'image_unconfigured' : 'provider_failed',
        errorMessage: 'Mock failure requested with [fail].', updatedAt: now })
    }
    var out
    if (isImage(x.model)) {
      var img = mockImage(x)
      out = { outputUrl: img, posterUrl: img, fileBytes: img.length }
    } else {
      var pool = VIDEO_OUT[x.workflow === 'motion' ? 'motion' : 'video']
      var pick = pool[db.seq % pool.length]
      out = { outputUrl: pick[0], posterUrl: pick[1], fileBytes: pick[2] }
    }
    return Object.assign(x, out, { status: 'completed', stage: null, progress: 100, completedAt: now, updatedAt: now })
  }
  function find(id) { var x = db.gens.find(function (q) { return q.id === id }); if (x) { tick(x); save(db) } return x }
  var clean = function (x) { var c = Object.assign({}, x); delete c._t0; delete c._dur; delete c._vs; return c }
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms) }) }

  function reply(body, status) {
    return Promise.resolve(new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json', 'X-Slate-Mock': '1' } }))
  }
  var notFound = function () { return reply({ error: { code: 'not_found', message: 'Not found (mock)' } }, 404) }

  function create(input, retryOf) {
    var now = new Date().toISOString()
    var model = input.model
    var x = Object.assign({}, base, {
      id: 'mock-' + (db.seq++), prompt: input.prompt, model: model, motion: input.motion || 'static',
      durationS: input.durationS || 6, aspectRatio: input.aspectRatio || '16:9', resolution: input.resolution || '720p',
      bitrate: input.bitrate || 'standard', referenceUrl: input.referenceUrl || null, workflow: input.workflow || null,
      provider: providerOf(model), status: 'queued', stage: null, progress: 0, createdAt: now, updatedAt: now,
      completedAt: null, retryOf: retryOf || null, _t0: isByokVideo(model) ? null : Date.now(), _dur: isImage(model) ? 5200 : 9000,
    })
    db.gens.unshift(x); save(db)
    return x
  }

  var MODELS = [
    { id: 'slate-cinematic-1', label: 'Slate Cinematic 1', description: 'Camera moves over a still.', providerId: 'cinematic', available: true },
    { id: 'ltx-2-pro', label: 'LTX-2 Pro', description: 'Generative video.', providerId: 'ltxv', badge: 'TOP', available: true },
    { id: 'gpt-image-1', label: 'GPT Image 1', description: 'Prompt to image.', providerId: 'gpt-image', kind: 'image', available: true },
  ]

  async function handle(path, url, method, init) {
    var body = null
    if (init && typeof init.body === 'string') { try { body = JSON.parse(init.body) } catch (e) {} }

    if (path === '/api/auth/session') {
      var out = sessionStorage.getItem(OUT_KEY) === '1'
      return reply({ user: out ? null : { id: 'mock-user', email: 'qa@slate.test' } })
    }
    if (path === '/api/auth/logout') { sessionStorage.setItem(OUT_KEY, '1'); return reply({ ok: true }) }
    if (path === '/api/auth/login' || path === '/api/auth/signup') { sessionStorage.removeItem(OUT_KEY); return reply({ ok: true }) }
    // QA stand-in for the connection test. Only this exact fake key "connects";
    // anything else fails like a rejected key. No provider is contacted.
    if (path === '/api/byok/test' && method === 'POST') {
      await sleep(700)
      var cred = body && body.credential
      if (!cred || !cred.apiKey || cred.apiKey.length < 8) return reply({ error: { code: 'invalid_request', message: 'Some settings are not valid', fields: { 'credential.apiKey': 'Enter the full API key' } } }, 400)
      if (cred.apiKey !== 'mock-valid-key-0000') return reply({ connected: false, error: { code: 'byok_auth_failed', message: 'The provider rejected this key.' } })
      var ALL = ['21:9', '16:9', '4:3', '1:1', '4:5', '9:16']
      var M = function (id, caps, runs) { return { id: id, label: id, capabilities: caps, runs: runs || {} } }
      var veo = function (d) { return { video: { aspectRatios: ['16:9', '9:16'], durations: d, imageToVideo: true, progress: false } } }
      var CATALOG = {
        google: [
          M('gemini-2.5-flash-image', ['textToImage', 'imageToImage'], { image: { aspectRatios: ALL, quality: false, output: 'PNG' } }),
          M('gemini-3-pro-image-preview', ['textToImage', 'imageToImage'], { image: { aspectRatios: ALL, quality: false, output: 'PNG' } }),
          M('veo-3.1-generate-preview', ['textToVideo', 'imageToVideo'], veo([4, 6, 8])),
          M('veo-3.0-generate-001', ['textToVideo', 'imageToVideo'], veo([8])),
          M('gemini-2.5-pro', ['textToText']),
          M('gemini-2.5-flash-preview-tts', ['textToSpeech']),
        ],
        openai: [
          M('gpt-4o', ['textToText']),
          M('gpt-image-1', ['textToImage'], { image: { aspectRatios: ALL, quality: true, output: 'JPEG' } }),
          M('sora-2', ['textToVideo', 'imageToVideo'], { video: { aspectRatios: ['16:9', '9:16'], durations: [4, 8, 12], imageToVideo: false, progress: true } }),
          M('whisper-1', ['speechToText']),
        ],
        openrouter: [
          M('openai/gpt-4o', ['textToText', 'imageUnderstanding']),
          M('google/gemini-2.5-flash-image', ['textToText', 'imageToImage', 'textToImage'], { image: { aspectRatios: ALL, quality: false, output: 'Model default' } }),
          M('google/veo-3.1', ['textToVideo', 'imageToVideo'], veo([4, 6, 8])),
          M('kwaivgi/kling-v3.0', ['textToVideo', 'imageToVideo'], { video: { aspectRatios: ['16:9', '9:16', '1:1'], durations: [5, 10], imageToVideo: true, progress: false } }),
        ],
        anthropic: [M('claude-opus-4-1', ['textToText', 'imageUnderstanding']), M('claude-haiku-4-5', ['textToText'])],
        mistral: [M('mistral-large-latest', ['textToText', 'imageUnderstanding'])],
      }
      return reply({ connected: true, models: CATALOG[cred.providerId] || [] })
    }
    if (path === '/api/models') {
      var noImg = sessionStorage.getItem('slate_mock_image_unconfigured') === '1'
      var models = MODELS.map(function (m) { return m.id === 'gpt-image-1' && noImg ? Object.assign({}, m, { available: false }) : m })
      return reply({ models: models, motions: [], settings: { aspectRatios: ['21:9', '16:9', '4:3', '1:1', '4:5', '9:16'], resolutions: ['480p', '720p', '1080p'], bitrates: ['standard', 'high'], duration: { min: 4, max: 30 } }, engines: [], persistence: { durable: false, adapter: 'mock' } })
    }
    if (path === '/api/uploads/reference' && method === 'POST') {
      var file = init && init.body && init.body.get ? init.body.get('image') : null
      await sleep(400)
      return reply({ url: file ? URL.createObjectURL(file) : '/explore/harbour-portrait.jpg', bytes: file ? file.size : 0 })
    }
    if (path === '/api/generations' && method === 'GET') {
      db.gens.forEach(tick); save(db)
      var limit = Number(url.searchParams.get('limit') || 30)
      return reply({ generations: db.gens.slice(0, limit).map(clean), nextCursor: null })
    }
    if (path === '/api/generations' && method === 'POST') {
      if (!body || !body.prompt || body.prompt.trim().length < 3) {
        return reply({ error: { code: 'invalid_input', message: 'Check the highlighted fields.', fields: { prompt: 'Write at least 3 characters.' } } }, 422)
      }
      if (body.model === 'gpt-image-1' && sessionStorage.getItem('slate_mock_image_unconfigured') === '1') {
        return reply({ error: { code: 'invalid_request', message: 'That model is not available', fields: { model: '"gpt-image-1" is not configured in this environment' } } }, 400)
      }
      var x = create(body)
      return reply({ generation: clean(x), execution: 'server' }, 201)
    }
    var m = path.match(/^\/api\/generations\/([^/]+)(\/(render|retry|artifact|poll))?$/)
    if (m) {
      var id = decodeURIComponent(m[1]), action = m[3]
      var job = find(id)
      if (!job) return notFound()
      if (action === 'render') {
        // Mirrors the server: a user-key job without a key in this request fails honestly.
        if (String(job.model).indexOf('byok:') === 0 && !(body && body.credential)) {
          Object.assign(job, { status: 'failed', _t0: null, errorCode: 'byok_key_missing', errorMessage: 'Your provider key is not active in this session. Configure the model again to use it.' })
          save(db); return reply({ generation: clean(job) })
        }
        if (isByokVideo(job.model)) {
          if (job.status !== 'queued') return reply({ error: { code: 'invalid_transition', message: 'Already started' } }, 409)
          await sleep(900)
          var t = new Date().toISOString()
          Object.assign(job, { status: 'generating', stage: 'render', progress: 0, providerJob: 'mock-op-' + job.id, _vs: Date.now(), heartbeatAt: t, updatedAt: t })
          save(db); return reply({ generation: clean(job), pending: true })
        }
        while (job.status !== 'completed' && job.status !== 'failed') { await sleep(400); tick(job); save(db) }
        return reply({ generation: clean(job) })
      }
      if (action === 'poll') {
        if (!(body && body.credential)) return reply({ error: { code: 'byok_key_missing', message: 'Your provider key is not active in this session. Connect it again to continue.' } }, 400)
        tick(job); save(db)
        return reply({ generation: clean(job), done: job.status === 'completed' || job.status === 'failed' })
      }
      if (action === 'retry') { var r = create(job, job.id); return reply({ generation: clean(r), execution: 'server' }, 201) }
      if (method === 'DELETE') { db.gens = db.gens.filter(function (q) { return q.id !== id }); save(db); return reply({ deleted: true }) }
      if (method === 'PATCH') {
        if (body && body.event === 'fail') Object.assign(job, { status: 'failed', errorCode: body.code, errorMessage: body.message, _t0: null })
        save(db); return reply({ generation: clean(job) })
      }
      return reply({ generation: clean(job) })
    }
    return reply({ error: { code: 'mock_unhandled', message: 'Mock API has no handler for ' + method + ' ' + path } }, 501)
  }

  window.fetch = function (input, init) {
    var href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    var url = new URL(href, location.href)
    if (url.origin === location.origin && url.pathname.indexOf('/api/') === 0) {
      var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase()
      return handle(url.pathname, url, method, init)
    }
    return realFetch(input, init)
  }

  window.__slateMockReset = function () { sessionStorage.removeItem(KEY); sessionStorage.removeItem(OUT_KEY); location.reload() }
  console.info('[slate mock] API mocked in the browser — no network, no credentials.')
})()
