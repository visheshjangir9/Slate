import type { NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { createGenerationSchema, listQuerySchema, randomSeed, type CreateGenerationInput } from '@/lib/generation/schema'
import { byokProviderTag, isByokModelId, parseByokModelId } from '@/lib/byok/catalog'
import { ownStorageKey } from '@/lib/byok/frames'
import type { Generation } from '@/lib/generation/types'
import { isKnownModel, modelIsAvailable, providerForModel } from '@/lib/providers/registry'
import { generationStore } from '@/lib/store'
import { resolveOwnerId } from '@/lib/api/session'
import { badRequest, fromZod, ok, serverError } from '@/lib/api/respond'
import type { MotionId } from '@/lib/engine/types'

/** Create a generation. Validates, negotiates with the provider, persists as `queued`. */
export async function POST(req: NextRequest) {
  try {
    const ownerId = await resolveOwnerId()
    const body = await req.json().catch(() => null)
    if (!body) return badRequest('Expected a JSON body')

    const input = createGenerationSchema.parse(body)
    if (isByokModelId(input.model)) return await createByok(ownerId, input)
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
      deviceId: ownerId,
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
      workflow: input.workflow ?? (provider.capabilities.id === 'gpt-image' ? 'image' : 'video'),
    })

    return ok({ generation: row, execution: provider.capabilities.execution }, { status: 201 })
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e)
    return serverError(e, 'create_failed')
  }
}

/**
 * A generation on the user's own provider. Only metadata is stored: the
 * provider tag, the model id (which records image or video), the prompt and
 * settings. The key itself is sent later, with the render or poll request,
 * and is never written anywhere.
 *
 * Documented providers (Google, OpenAI) are checked against the parameters
 * the model documents; a gateway (OpenRouter) is checked for shape, and the
 * provider itself validates the rest.
 */
async function createByok(ownerId: string, input: CreateGenerationInput) {
  const target = parseByokModelId(input.model)
  if (!target) return badRequest('Unsupported model', { model: 'That provider model is not supported by Slate' })
  const workflow = target.op === 'image' ? 'image' : 'video'
  if (input.workflow && input.workflow !== workflow) {
    return badRequest('Unsupported model', { model: `This model generates ${target.op === 'image' ? 'images' : 'video'}; use the ${target.op === 'image' ? 'Image' : 'Video'} workflow` })
  }

  let referenceUrl: string | null = null
  if (target.op === 'image') {
    const spec = target.runs?.image
    if (spec?.aspectRatios.length && !spec.aspectRatios.includes(input.aspectRatio)) {
      return badRequest('Some settings are not valid', { aspectRatio: `This model does not take ${input.aspectRatio}` })
    }
  } else {
    const spec = target.runs?.video
    if (spec && !spec.aspectRatios.includes(input.aspectRatio)) {
      return badRequest('Some settings are not valid', { aspectRatio: `This model does not take ${input.aspectRatio}` })
    }
    if (spec && !spec.durations.includes(input.durationS)) {
      return badRequest('Some settings are not valid', { durationS: `This model renders ${spec.durations.join(', ')} seconds` })
    }
    if (input.referenceUrl) {
      if (spec && !spec.imageToVideo) {
        return badRequest('Some settings are not valid', { referenceUrl: 'This model does not take a first frame in Slate' })
      }
      // Only an image uploaded to Slate can be a first frame (no arbitrary URLs).
      if (!ownStorageKey(input.referenceUrl)) {
        return badRequest('Some settings are not valid', { referenceUrl: 'Upload the first frame to Slate' })
      }
      referenceUrl = input.referenceUrl
    }
  }

  const row = await generationStore().create({
    deviceId: ownerId,
    prompt: input.prompt,
    model: input.model,
    motion: 'static',
    durationS: target.op === 'video' ? input.durationS : 4,
    aspectRatio: input.aspectRatio,
    resolution: '720p',
    bitrate: target.op === 'image' && target.runs?.image?.quality ? input.bitrate : 'standard',
    referenceUrl,
    seed: input.seed ?? randomSeed(),
    status: 'queued',
    stage: null,
    progress: 0,
    outputUrl: null,
    posterUrl: null,
    fileBytes: null,
    errorCode: null,
    errorMessage: null,
    provider: byokProviderTag(target.providerId),
    adjustments: [],
    retryOf: null,
    workflow,
  })
  return ok({ generation: row, execution: 'server' }, { status: 201 })
}

/** History for this device, newest first. */
export async function GET(req: NextRequest) {
  try {
    const ownerId = await resolveOwnerId()
    const url = new URL(req.url)
    const q = listQuerySchema.parse({
      limit: url.searchParams.get('limit') ?? undefined,
      cursor: url.searchParams.get('cursor') ?? undefined,
    })

    const store = generationStore()
    // Cheap opportunistic sweep: a tab closed mid-render should not leave a
    // job spinning forever in the history rail.
    await store.sweepStale()

    const { items, nextCursor } = await store.listByDevice(ownerId, q)
    return ok({ generations: items as Generation[], nextCursor })
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e)
    return serverError(e, 'list_failed')
  }
}
