import type { NextRequest } from 'next/server'
import { reduce } from '@/lib/generation/state'
import { blobStore, generationStore } from '@/lib/store'
import { resolveOwnerId } from '@/lib/api/session'
import { badRequest, conflict, notFound, ok, serverError } from '@/lib/api/respond'
import { inspectImage } from '@/lib/byok/media'
import { sniffVideo } from '@/lib/security/fileType'
import { securityEvent } from '@/lib/security/audit'

type Ctx = { params: Promise<{ id: string }> }

// Must not exceed the storage bucket's per-object limit, which is itself
// capped by the project's global upload limit (50MB on the free tier).
// Measured worst case is ~19MB for 30s of 1080p at high bitrate.
const MAX_BYTES = 50 * 1024 * 1024
const ALLOWED_VIDEO = ['video/mp4', 'video/webm']
const ALLOWED_POSTER = ['image/jpeg', 'image/png', 'image/webp']
const MAX_POSTER_BYTES = 10 * 1024 * 1024

/** Receive the finished render from the client and mark the job completed. */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const ownerId = await resolveOwnerId()
    const store = generationStore()
    const row = await store.get(id)
    if (!row || row.deviceId !== ownerId) return notFound('That generation does not exist')

    const form = await req.formData().catch(() => null)
    if (!form) return badRequest('Expected multipart form data')

    const video = form.get('video')
    if (!(video instanceof File)) return badRequest('Missing "video" file')
    if (!ALLOWED_VIDEO.includes(video.type)) {
      return badRequest(`Unsupported video type "${video.type}"`)
    }
    if (video.size === 0) return badRequest('Video file is empty')
    if (video.size > MAX_BYTES) return badRequest('Video exceeds the 50MB size limit')

    // The declared type is a label; the bytes decide, and the file is stored
    // under its real type so it can never be served as anything else.
    const videoBytes = new Uint8Array(await video.arrayBuffer())
    const realType = sniffVideo(videoBytes)
    if (!realType) {
      securityEvent('upload_rejected', { route: 'artifact', owner: ownerId, declared: video.type, bytes: video.size })
      return badRequest('That file is not a readable MP4 or WebM video.')
    }
    const blobs = blobStore()
    const ext = realType === 'video/mp4' ? 'mp4' : 'webm'
    const videoUrl = await blobs.put(`${id}.${ext}`, videoBytes, realType)

    // The poster is optional: anything that is not really a small image is dropped, not stored.
    let posterUrl: string | null = null
    const poster = form.get('poster')
    if (poster instanceof File && poster.size > 0 && poster.size <= MAX_POSTER_BYTES && ALLOWED_POSTER.includes(poster.type)) {
      const posterBytes = new Uint8Array(await poster.arrayBuffer())
      const info = inspectImage(posterBytes)
      if (info) posterUrl = await blobs.put(`${id}-poster.${info.ext}`, posterBytes, info.mime)
    }

    const result = reduce(row, {
      type: 'complete',
      outputUrl: videoUrl,
      posterUrl,
      fileBytes: video.size,
    })
    if (!result.ok) {
      // Clean up the blob we just wrote rather than leaking it.
      await blobs.remove(`${id}.${ext}`)
      return conflict(result.error.code, result.error.message)
    }

    const updated = await store.patch(id, result.patch)
    return ok({ generation: updated })
  } catch (e) {
    return serverError(e, 'artifact_failed')
  }
}
