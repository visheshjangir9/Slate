import 'server-only'
import { resolveDeviceId } from '@/lib/api/session'
import { generationStore } from '@/lib/store'

/**
 * Work made as a guest in this browser follows the user into their account,
 * so signing up after a first render does not lose it. Never fails sign-in.
 */
export async function adoptGuestWork(owner: string): Promise<number> {
  try {
    const device = await resolveDeviceId()
    return await generationStore().reassignOwner(device, owner)
  } catch {
    return 0
  }
}
