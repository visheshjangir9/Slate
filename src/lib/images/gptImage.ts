import 'server-only'
import type { AspectRatio } from '@/lib/engine/types'
import { centerCropJpeg } from './centerCrop'
import { gptNativeSize, imageOutputDims, IMAGE_QUALITY } from './dims'

/**
 * GPT Image for the Image workflow.
 *
 * Deliberately separate from the still-frame chain used by video. That chain
 * falls through to other providers; here the user chose GPT Image by name, so
 * a failure is reported as a failure and never quietly replaced by a
 * different model's output.
 */
const ENDPOINT = 'https://api.openai.com/v1/images/generations'
export const GPT_IMAGE_MODEL = 'gpt-image-1'

export class ImageGenError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

export const gptImageConfigured = (): boolean => {
  const k = process.env.OPENAI_API_KEY
  return Boolean(k && k.startsWith('sk-') && k.length > 24 && !/x{4,}/i.test(k))
}

export interface GptImageResult {
  bytes: Uint8Array
  width: number
  height: number
}

export async function generateGptImage(opts: {
  prompt: string
  aspectRatio: AspectRatio
  quality: keyof typeof IMAGE_QUALITY
  signal?: AbortSignal
}): Promise<GptImageResult> {
  const key = process.env.OPENAI_API_KEY
  if (!key || !gptImageConfigured()) throw new ImageGenError('image_unconfigured', 'GPT Image is not configured.')

  const native = gptNativeSize(opts.aspectRatio)
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    signal: opts.signal,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GPT_IMAGE_MODEL,
      prompt: opts.prompt,
      size: `${native.width}x${native.height}`,
      quality: IMAGE_QUALITY[opts.quality],
      output_format: 'jpeg',
      output_compression: 95,
      n: 1,
    }),
  }).catch((e: unknown) => {
    if (e instanceof Error && e.name === 'AbortError') throw new ImageGenError('image_timeout', 'GPT Image took too long.')
    throw new ImageGenError('image_failed', 'Could not reach GPT Image.')
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { code?: string; type?: string } } | null
    const code = body?.error?.code ?? ''
    if (code === 'insufficient_quota' || code === 'billing_hard_limit_reached') {
      throw new ImageGenError('image_no_credit', 'The OpenAI account is out of credit.')
    }
    if (res.status === 429) throw new ImageGenError('image_rate_limited', 'GPT Image is rate limiting us.')
    if (res.status === 401 || res.status === 403) throw new ImageGenError('image_unauthorized', 'GPT Image rejected our credentials.')
    if (code === 'moderation_blocked' || code === 'content_policy_violation') {
      throw new ImageGenError('image_blocked', 'GPT Image declined this prompt.')
    }
    throw new ImageGenError('image_failed', 'GPT Image could not complete this image.')
  }

  const body = (await res.json()) as { data?: { b64_json?: string }[] }
  const b64 = body?.data?.[0]?.b64_json
  if (!b64) throw new ImageGenError('image_failed', 'GPT Image returned no image.')

  const raw = Uint8Array.from(Buffer.from(b64, 'base64'))
  const out = imageOutputDims(opts.aspectRatio)
  const bytes = centerCropJpeg(raw, out.width, out.height)
  if (!bytes) throw new ImageGenError('image_failed', 'The returned image could not be cropped to your frame.')
  return { bytes, width: out.width, height: out.height }
}
