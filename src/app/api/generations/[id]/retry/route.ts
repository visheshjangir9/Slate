import type { NextRequest } from 'next/server'
import { generationStore } from '@/lib/store'
import { resolveOwnerId } from '@/lib/api/session'
import { notFound, ok, serverError } from '@/lib/api/respond'
import { providerForModel } from '@/lib/providers/registry'
import { isByokProviderTag } from '@/lib/byok/catalog'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Retry clones the parameters into a NEW job rather than resetting the old one,
 * so the history keeps an honest record of the attempt that failed.
 */
export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const ownerId = await resolveOwnerId()
    const store = generationStore()
    const source = await store.get(id)
    if (!source || source.deviceId !== ownerId) {
      return notFound('That generation does not exist')
    }

    // A job on the user's own key keeps that provider and still runs on the
    // server; the key is sent again with the render, never stored.
    const byok = isByokProviderTag(source.provider)
    const provider = providerForModel(source.model)
    const clone = await store.create({
      deviceId: ownerId,
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
      provider: byok ? source.provider : provider.capabilities.id,
      adjustments: [],
      retryOf: source.id,
      workflow: source.workflow ?? null,
    })

    return ok({ generation: clone, execution: byok ? 'server' : provider.capabilities.execution }, { status: 201 })
  } catch (e) {
    return serverError(e, 'retry_failed')
  }
}
