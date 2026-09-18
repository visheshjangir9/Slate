import type { NextRequest } from 'next/server'
import { generationStore } from '@/lib/store'
import { resolveDeviceId } from '@/lib/api/session'
import { notFound, ok, serverError } from '@/lib/api/respond'
import { providerForModel } from '@/lib/providers/registry'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Retry clones the parameters into a NEW job rather than resetting the old one,
 * so the history keeps an honest record of the attempt that failed.
 */
export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const deviceId = await resolveDeviceId()
    const store = generationStore()
    const source = await store.get(id)
    if (!source || source.deviceId !== deviceId) {
      return notFound('That generation does not exist')
    }

    const provider = providerForModel(source.model)
    const clone = await store.create({
      deviceId,
      prompt: source.prompt,
      model: source.model,
      motion: source.motion,
      durationS: source.durationS,
      aspectRatio: source.aspectRatio,
      resolution: source.resolution,
      bitrate: source.bitrate,
      referenceUrl: source.referenceUrl,
      seed: source.seed,
      status: 'queued',
      stage: null,
      progress: 0,
      outputUrl: null,
      posterUrl: null,
      fileBytes: null,
      errorCode: null,
      errorMessage: null,
      provider: provider.capabilities.id,
      adjustments: [],
      retryOf: source.id,
    })

    return ok({ generation: clone, execution: provider.capabilities.execution }, { status: 201 })
  } catch (e) {
    return serverError(e, 'retry_failed')
  }
}
