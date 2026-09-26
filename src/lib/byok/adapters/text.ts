import 'server-only'
import type { Capability, DiscoveredModel } from '../catalog'
import { errorForStatus, providerFetch } from '../http'
import type { ByokAdapter } from './types'

/**
 * Providers Slate can authenticate and discover, but whose models are text
 * models: they connect honestly and say their models are not usable in the
 * current image and video workflows. No generation is attempted.
 *
 * Anthropic   https://api.anthropic.com/v1/models
 *             headers x-api-key, anthropic-version: 2023-06-01;
 *             data[].capabilities.image_input.supported (published metadata)
 * Mistral     https://api.mistral.ai/v1/models, Authorization: Bearer;
 *             data[].capabilities { completion_chat, vision, … } (published metadata)
 */
export const anthropicAdapter: ByokAdapter = {
  id: 'anthropic',
  async listModels(cred, policy) {
    const out: DiscoveredModel[] = []
    let after = ''
    for (let page = 0; page < 3; page++) {
      const res = await providerFetch(`https://api.anthropic.com/v1/models?limit=1000${after ? `&after_id=${encodeURIComponent(after)}` : ''}`, {
        headers: { 'x-api-key': cred.apiKey, 'anthropic-version': '2023-06-01' },
      }, policy)
      if (!res.ok) throw errorForStatus(res.status)
      const body = (await res.json().catch(() => null)) as {
        data?: { id?: string; display_name?: string; capabilities?: { image_input?: { supported?: boolean } } | null }[]
        has_more?: boolean; last_id?: string | null
      } | null
      for (const m of body?.data ?? []) {
        if (!m.id) continue
        const caps: Capability[] = ['textToText', ...(m.capabilities?.image_input?.supported ? ['imageUnderstanding' as const] : [])]
        out.push({ id: m.id, label: m.display_name || m.id, capabilities: caps, runs: {} })
      }
      if (!body?.has_more || !body.last_id) break
      after = body.last_id
    }
    return out
  },
}

export const mistralAdapter: ByokAdapter = {
  id: 'mistral',
  async listModels(cred, policy) {
    const res = await providerFetch('https://api.mistral.ai/v1/models', { headers: { Authorization: `Bearer ${cred.apiKey}` } }, policy)
    if (!res.ok) throw errorForStatus(res.status)
    const body = (await res.json().catch(() => null)) as {
      data?: { id?: string; name?: string | null; archived?: boolean; capabilities?: { completion_chat?: boolean; vision?: boolean } }[]
    } | null
    return (body?.data ?? []).flatMap((m) => {
      if (!m.id || m.archived) return []
      const caps: Capability[] = [
        ...(m.capabilities?.completion_chat ? ['textToText' as const] : []),
        ...(m.capabilities?.vision ? ['imageUnderstanding' as const] : []),
      ]
      return caps.length ? [{ id: m.id, label: m.name || m.id, capabilities: caps, runs: {} }] : []
    })
  },
}
