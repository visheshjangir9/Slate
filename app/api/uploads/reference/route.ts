import type { NextRequest } from 'next/server'
import { blobStore } from '@/lib/store'
import { resolveDeviceId } from '@/lib/api/session'
import { badRequest, ok, serverError } from '@/lib/api/respond'

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
    const deviceId = await resolveDeviceId()
    const form = await req.formData().catch(() => null)
    if (!form) return badRequest('Expected multipart form data')

    const file = form.get('image')
    if (!(file instanceof File)) return badRequest('Missing "image" file')
    if (!ALLOWED.includes(file.type)) {
      return badRequest(`Unsupported image type "${file.type}". Use JPEG, PNG or WebP.`)
    }
    if (file.size === 0) return badRequest('Image is empty')
    if (file.size > MAX_BYTES) return badRequest('Image exceeds the 10MB limit')

    const ext = file.type.split('/')[1]
    const key = `ref-${deviceId.slice(0, 8)}-${crypto.randomUUID()}.${ext}`
    const url = await blobStore().put(key, new Uint8Array(await file.arrayBuffer()), file.type)
    return ok({ url, bytes: file.size }, { status: 201 })
  } catch (e) {
    return serverError(e, 'reference_upload_failed')
  }
}
