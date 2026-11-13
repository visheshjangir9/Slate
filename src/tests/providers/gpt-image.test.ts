import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FAKE_OPENAI_KEY } from '@/tests/fixtures'
import { GPT_IMAGE_MODEL, generateGptImage } from '@/lib/images/gptImage'
import { openaiImages } from '@/lib/images/openai'

/**
 * What Slate sends to OpenAI, with the network stubbed and a fake key. The
 * model name matters: gpt-image-1 was shut down on 2026-10-23 and every call
 * to it failed as a generic "could not complete this image".
 */
const sent: { model?: string }[] = []
let reply: Response

beforeEach(() => {
  sent.length = 0
  process.env.OPENAI_API_KEY = FAKE_OPENAI_KEY
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL, init?: RequestInit) => {
    expect(String(input)).toBe('https://api.openai.com/v1/images/generations')
    sent.push(JSON.parse(String(init?.body)))
    return reply
  }))
})
afterEach(() => {
  delete process.env.OPENAI_API_KEY
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const notFound = () => new Response(JSON.stringify({ error: { code: 'model_not_found', type: 'invalid_request_error', message: 'The model does not exist' } }), { status: 404 })

describe('GPT Image requests', () => {
  it('ask for a model OpenAI still runs, never the retired gpt-image-1', async () => {
    expect(GPT_IMAGE_MODEL).not.toBe('gpt-image-1')
    reply = notFound()
    await generateGptImage({ prompt: 'a pocket watch', aspectRatio: '16:9', quality: 'standard' }).catch(() => {})
    reply = notFound()
    await openaiImages.fetchStill({ prompt: 'a pocket watch', width: 1280, height: 720, seed: 1 }, new AbortController().signal)
    expect(sent.map((b) => b.model)).toEqual([GPT_IMAGE_MODEL, GPT_IMAGE_MODEL])
  })

  it('log why OpenAI refused, without the key or the prompt', async () => {
    reply = notFound()
    await expect(generateGptImage({ prompt: 'a secret prompt', aspectRatio: '1:1', quality: 'standard' }))
      .rejects.toMatchObject({ code: 'image_failed' })
    const line = vi.mocked(console.warn).mock.calls.map((c) => c.join(' ')).join('\n')
    expect(line).toContain('[slate:image_upstream] generate')
    expect(line).toContain('"status":404')
    expect(line).toContain('model_not_found')
    expect(line).not.toContain(FAKE_OPENAI_KEY)
    expect(line).not.toContain('a secret prompt')
  })

  it('an empty balance is reported as out of credit, not as a failed image', async () => {
    reply = new Response(JSON.stringify({ error: { code: 'insufficient_quota', type: 'insufficient_quota' } }), { status: 429 })
    await expect(generateGptImage({ prompt: 'a pocket watch', aspectRatio: '1:1', quality: 'standard' }))
      .rejects.toMatchObject({ code: 'image_no_credit' })
  })
})
