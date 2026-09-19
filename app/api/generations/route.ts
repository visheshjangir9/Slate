import type { NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { createGenerationSchema, listQuerySchema, randomSeed } from '@/lib/generation/schema'
import type { Generation } from '@/lib/generation/types'
import { isKnownModel, modelIsAvailable, providerForModel } from '@/lib/providers/registry'
import { generationStore } from '@/lib/store'
import { resolveDeviceId } from '@/lib/api/session'
import { badRequest, fromZod, ok, serverError } from '@/lib/api/respond'
import type { MotionId } from '@/lib/engine/types'

/** Create a generation. Validates, negotiates with the provider, persists as `queued`. */
export async function POST(req: NextRequest) {
  try {
    const deviceId = await resolveDeviceId()
    const body = await req.json().catch(() => null)
    if (!body) return badRequest('Expected a JSON body')

    const input = createGenerationSchema.parse(body)
    if (!isKnownModel(input.model)) {
      return badRequest('Unknown model', { model: `"${input.model}" is not a model we offer` })
    }
    // Never substitute a different engine for the one that was chosen.
    if (!modelIsAvailable(input.model)) {
      return badRequest('That model is not available', {
        model: `"${input.model}" is not configured in this environment`,
      })
    }

    const provider = providerForModel(input.model)
    const seed = input.seed ?? randomSeed()
    const { normalized, adjustments } = provider.negotiate({
      prompt: input.prompt,
      model: input.model,
      motion: input.motion as MotionId,
      durationS: input.durationS,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      bitrate: input.bitrate,
      seed,
      referenceUrl: input.referenceUrl ?? null,
    })

    const row = await generationStore().create({
      deviceId,
      prompt: normalized.prompt,
      model: normalized.model,
      motion: normalized.motion,
      durationS: normalized.durationS,
      aspectRatio: normalized.aspectRatio,
      resolution: normalized.resolution,
      bitrate: normalized.bitrate,
      referenceUrl: normalized.referenceUrl ?? null,
      seed: normalized.seed,
      status: 'queued',
      stage: null,
      progress: 0,
      outputUrl: null,
      posterUrl: null,
      fileBytes: null,
      errorCode: null,
      errorMessage: null,
      provider: provider.capabilities.id,
      adjustments,
      retryOf: null,
    })

    return ok({ generation: row, execution: provider.capabilities.execution }, { status: 201 })
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e)
    return serverError(e, 'create_failed')
  }
}

/** History for this device, newest first. */
export async function GET(req: NextRequest) {
  try {
    const deviceId = await resolveDeviceId()
    const url = new URL(req.url)
    const q = listQuerySchema.parse({
      limit: url.searchParams.get('limit') ?? undefined,
      cursor: url.searchParams.get('cursor') ?? undefined,
    })

    const store = generationStore()
    // Cheap opportunistic sweep: a tab closed mid-render should not leave a
    // job spinning forever in the history rail.
    await store.sweepStale()

    const { items, nextCursor } = await store.listByDevice(deviceId, q)
    return ok({ generations: items as Generation[], nextCursor })
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e)
    return serverError(e, 'list_failed')
  }
}
