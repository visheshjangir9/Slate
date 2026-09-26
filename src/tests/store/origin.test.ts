import { describe, expect, it } from 'vitest'
import { readOrigin, withOrigin } from '@/lib/store/origin'

const real = { field: 'duration', requested: '12s', actual: '8s', reason: 'LTX-2 renders 4, 6 or 8 second clips' }

describe('workflow origin marker', () => {
  it('round-trips the workflow and leaves real adjustments untouched', () => {
    const stored = withOrigin([real], 'motion')
    expect(readOrigin(stored)).toEqual({ adjustments: [real], workflow: 'motion' })
  })

  it('never leaks the marker to the app', () => {
    const { adjustments } = readOrigin(withOrigin([], 'image'))
    expect(adjustments).toEqual([])
  })

  it('reads legacy rows without a marker as unknown', () => {
    expect(readOrigin([real]).workflow).toBeNull()
    expect(readOrigin(null)).toEqual({ adjustments: [], workflow: null })
  })

  it('replaces rather than duplicates an existing marker', () => {
    const twice = withOrigin(withOrigin([], 'video'), 'motion')
    expect(twice.filter((a) => a.field === '__origin')).toHaveLength(1)
    expect(readOrigin(twice).workflow).toBe('motion')
  })

  it('ignores a marker holding an unknown value', () => {
    expect(readOrigin([{ field: '__origin', requested: 'x', actual: 'x', reason: '' }]).workflow).toBeNull()
  })
})
