import 'server-only'
import { blobStore } from '@/lib/store'

/** Minimal container sniff. A provider returning HTML or JSON must not pass. */
export function looksLikeVideo(bytes: Uint8Array, contentType: string): boolean {
  if (bytes.byteLength < 1024) return false
  const head = Buffer.from(bytes.subarray(0, 16))
  // ISO-BMFF (mp4/mov): 'ftyp' at offset 4. WebM/Matroska: EBML magic.
  const isMp4 = head.subarray(4, 8).toString('latin1') === 'ftyp'
  const isWebm = head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3
  if (isMp4 || isWebm) return true
  // Fall back to the declared type only if it is plausibly video.
  return contentType.startsWith('video/')
}

export interface StoredArtifact {
  url: string
  bytes: number
  contentType: string
}

/**
 * Download a provider's output and re-host it.
 *
 * Provider URLs expire; history must not. Nothing is marked completed until
 * the bytes are validated as real video AND stored under our own URL.
 */
export async function persistVideo(
  generationId: string,
  sourceUrl: string,
  signal?: AbortSignal,
): Promise<StoredArtifact> {
  const res = await fetch(sourceUrl, { signal })
  if (!res.ok) throw new Error(`artifact_download_failed:${res.status}`)

  const contentType = res.headers.get('content-type') ?? 'video/mp4'
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (!looksLikeVideo(bytes, contentType)) throw new Error('artifact_not_video')

  const ext = contentType.includes('webm') ? 'webm' : 'mp4'
  const url = await blobStore().put(`${generationId}.${ext}`, bytes, `video/${ext}`)
  return { url, bytes: bytes.byteLength, contentType: `video/${ext}` }
}
