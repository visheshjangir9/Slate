import type { NextRequest } from 'next/server'
import { blobStore } from '@/lib/store'
import { notFound, serverError } from '@/lib/api/respond'

type Ctx = { params: Promise<{ key: string }> }

/** Serves artifacts held by the in-memory blob adapter (dev/local only). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { key } = await ctx.params
    const blob = await blobStore().get(decodeURIComponent(key))
    if (!blob) return notFound('Artifact not found')

    return new Response(blob.bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': blob.contentType,
        'Content-Length': String(blob.bytes.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (e) {
    return serverError(e, 'blob_failed')
  }
}
