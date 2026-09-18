import type { NextRequest } from 'next/server'
import { reduce } from '@/lib/generation/state'
import { blobStore, generationStore } from '@/lib/store'
import { resolveDeviceId } from '@/lib/api/session'
import { badRequest, conflict, notFound, ok, serverError } from '@/lib/api/respond'

type Ctx = { params: Promise<{ id: string }> }

const MAX_BYTES = 120 * 1024 * 1024
const ALLOWED_VIDEO = ['video/mp4', 'video/webm']
const ALLOWED_POSTER = ['image/jpeg', 'image/png', 'image/webp']

/** Receive the finished render from the client and mark the job completed. */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const deviceId = await resolveDeviceId()
    const store = generationStore()
    const row = await store.get(id)
    if (!row || row.deviceId !== deviceId) return notFound('That generation does not exist')

    const form = await req.formData().catch(() => null)
    if (!form) return badRequest('Expected multipart form data')

    const video = form.get('video')
    if (!(video instanceof File)) return badRequest('Missing "video" file')
    if (!ALLOWED_VIDEO.includes(video.type)) {
      return badRequest(`Unsupported video type "${video.type}"`)
    }
    if (video.size === 0) return badRequest('Video file is empty')
    if (video.size > MAX_BYTES) return badRequest('Video exceeds the size limit')

    const blobs = blobStore()
    const ext = video.type === 'video/mp4' ? 'mp4' : 'webm'
    const videoUrl = await blobs.put(
      `${id}.${ext}`,
      new Uint8Array(await video.arrayBuffer()),
      video.type,
    )

    let posterUrl: string | null = null
    const poster = form.get('poster')
    if (poster instanceof File && poster.size > 0 && ALLOWED_POSTER.includes(poster.type)) {
      const pExt = poster.type.split('/')[1]
      posterUrl = await blobs.put(
        `${id}-poster.${pExt}`,
        new Uint8Array(await poster.arrayBuffer()),
        poster.type,
      )
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
