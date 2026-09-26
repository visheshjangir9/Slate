import type { NextRequest } from 'next/server'
import { blobStore } from '@/lib/store'
import { resolveOwnerId } from '@/lib/api/session'
import { badRequest, ok, serverError } from '@/lib/api/respond'
import { inspectImage } from '@/lib/byok/media'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Store a reference image and return its URL.
 *
 * The reference is not decoration: when present it replaces the generated
 * still as the actual source frame the camera move runs over, so it must be
 * persisted or a retry would silently render something different.
 */
export async function POST(req: NextRequest) {
  try {
    // Establishes the owner cookie; uploads are keyed randomly, not by owner.
    await resolveOwnerId()
    const form = await req.formData().catch(() => null)
    if (!form) return badRequest('Expected multipart form data')

    const file = form.get('image')
    if (!(file instanceof File)) return badRequest('Missing "image" file')
    if (!ALLOWED.includes(file.type)) {
      return badRequest(`Unsupported image type "${file.type}". Use JPEG, PNG or WebP.`)
    }
    if (file.size === 0) return badRequest('Image is empty')
    if (file.size > MAX_BYTES) return badRequest('Image exceeds the 10MB limit')

    // The declared type is the browser's guess; the bytes decide. A file that
    // is not really an image is refused, and it is stored under its real type.
    const bytes = new Uint8Array(await file.arrayBuffer())
    const info = inspectImage(bytes)
    if (!info) return badRequest('That file is not a readable JPEG, PNG or WebP image.')
    const key = `ref-${crypto.randomUUID()}.${info.ext}`
    const url = await blobStore().put(key, bytes, info.mime)
    return ok({ url, bytes: file.size }, { status: 201 })
  } catch (e) {
    return serverError(e, 'reference_upload_failed')
  }
}
