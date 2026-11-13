/**
 * What a video upload really is, read from its first bytes.
 *
 * The browser's declared type is a label the sender chooses; the stored
 * object is served under whatever type we give it, so it must come from the
 * bytes. MP4 (ISO base media) opens with an `ftyp` box; WebM opens with the
 * EBML magic number.
 */
export function sniffVideo(b: Uint8Array): 'video/mp4' | 'video/webm' | null {
  if (b.length < 12) return null
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'video/mp4'
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm'
  return null
}
