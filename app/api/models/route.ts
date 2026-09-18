import { NextResponse } from 'next/server'
import { listModels, availableProviders } from '@/lib/providers/registry'
import { MOTIONS } from '@/lib/engine/motion'
import { ASPECT_RATIOS, BITRATES, MAX_DURATION_S, MIN_DURATION_S, RESOLUTIONS } from '@/lib/engine/types'
import { persistenceIsDurable } from '@/lib/store'

/** Everything the composer needs to render itself. One request, no waterfalls. */
export async function GET() {
  return NextResponse.json({
    models: listModels(),
    motions: MOTIONS.map((m) => ({
      id: m.id, label: m.label, description: m.description, badge: m.badge,
    })),
    settings: {
      aspectRatios: ASPECT_RATIOS,
      resolutions: RESOLUTIONS,
      bitrates: BITRATES,
      duration: { min: MIN_DURATION_S, max: MAX_DURATION_S },
    },
    engines: availableProviders().map((p) => ({
      id: p.capabilities.id,
      label: p.capabilities.label,
      description: p.capabilities.description,
      execution: p.capabilities.execution,
      sunsetAt: p.capabilities.sunsetAt ?? null,
    })),
    persistence: { durable: persistenceIsDurable() },
  })
}
