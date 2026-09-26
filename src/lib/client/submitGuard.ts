/**
 * One action, one job. While a submission is in flight, further calls are
 * dropped rather than queued: a double click or a repeated ⌘↵ must never
 * start a second, billable generation.
 */
export function createSubmitGuard() {
  let busy = false
  return {
    get busy() { return busy },
    async run<T>(fn: () => Promise<T>): Promise<T | undefined> {
      if (busy) return undefined
      busy = true
      try {
        return await fn()
      } finally {
        busy = false
      }
    },
  }
}
