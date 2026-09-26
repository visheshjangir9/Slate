import type { NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { failSchema, progressSchema } from '@/lib/generation/schema'
import { reduce, type GenerationEvent } from '@/lib/generation/state'
import { generationStore } from '@/lib/store'
import { resolveOwnerId } from '@/lib/api/session'
import { badRequest, conflict, fromZod, notFound, ok, serverError } from '@/lib/api/respond'

type Ctx = { params: Promise<{ id: string }> }

/** Ownership check: a device may only ever touch its own jobs. */
async function own(id: string) {
  const ownerId = await resolveOwnerId()
  const row = await generationStore().get(id)
  if (!row || row.deviceId !== ownerId) return null
  return row
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const row = await own(id)
    if (!row) return notFound('That generation does not exist')

    // Poll-through: sweeping here means the client's own status poll drives
    // stale detection, with no cron or background worker to deploy.
    const store = generationStore()
    const r = reduce(row, { type: 'sweep' })
    if (r.ok) {
      const swept = await store.patch(id, r.patch)
      return ok({ generation: swept ?? row })
    }
    return ok({ generation: row })
  } catch (e) {
    return serverError(e, 'get_failed')
  }
}

/**
 * Apply a lifecycle event. Every transition goes through the state machine, so
 * an illegal move is rejected here rather than silently corrupting the row.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const row = await own(id)
    if (!row) return notFound('That generation does not exist')

    const body = await req.json().catch(() => null)
    if (!body || typeof body.event !== 'string') {
      return badRequest('Expected { event: "start" | "progress" | "fail" }')
    }

    let event: GenerationEvent
    switch (body.event) {
      case 'start':
        event = { type: 'start' }
        break
      case 'progress':
        event = { type: 'progress', ...progressSchema.parse(body) }
        break
      case 'fail': {
        const f = failSchema.parse(body)
        event = { type: 'fail', code: f.code, message: f.message }
        break
      }
      default:
        return badRequest(`Unknown event "${body.event}"`)
    }

    const result = reduce(row, event)
    if (!result.ok) return conflict(result.error.code, result.error.message)

    const updated = await generationStore().patch(id, result.patch)
    return ok({ generation: updated })
  } catch (e) {
    if (e instanceof ZodError) return fromZod(e)
    return serverError(e, 'patch_failed')
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const row = await own(id)
    if (!row) return notFound('That generation does not exist')
    await generationStore().remove(id)
    return ok({ deleted: true })
  } catch (e) {
    return serverError(e, 'delete_failed')
  }
}
