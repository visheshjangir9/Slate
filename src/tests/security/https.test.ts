import { describe, expect, it } from 'vitest'
import { httpsRedirectTarget } from '@/lib/security/https'

const at = (url: string, forwardedProto: string | null, host = 'slate.example', production = true) =>
  httpsRedirectTarget({ url, host, forwardedProto, production })

describe('force HTTPS', () => {
  it('redirects a plain-HTTP production request to the same URL over HTTPS', () => {
    expect(at('http://slate.example/explore?q=rain#x', 'http')).toBe('https://slate.example/explore?q=rain#x')
  })

  it('uses the first hop of a forwarded-proto list', () => {
    expect(at('http://slate.example/', 'http, https')).toBe('https://slate.example/')
    expect(at('http://slate.example/', 'https, http')).toBeNull()
  })

  it('drops a non-standard port and keeps the public host', () => {
    expect(at('http://10.0.0.5:3000/about', 'http', 'slate.example')).toBe('https://slate.example/about')
  })

  it('leaves HTTPS, development and localhost alone', () => {
    expect(at('https://slate.example/', 'https')).toBeNull()
    expect(at('http://slate.example/', 'http', 'slate.example', false)).toBeNull()
    expect(at('http://localhost:3000/', 'http', 'localhost:3000')).toBeNull()
    expect(at('http://127.0.0.1:3000/', 'http', '127.0.0.1:3000')).toBeNull()
  })

  it('does nothing without a forwarded scheme or a host', () => {
    expect(at('http://slate.example/', null)).toBeNull()
    expect(httpsRedirectTarget({ url: 'http://x/', host: null, forwardedProto: 'http', production: true })).toBeNull()
  })
})
