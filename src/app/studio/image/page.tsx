import { requireUser } from '@/lib/auth/guard'
import { withQuery } from '@/lib/auth/next'
import { StudioRoute } from '@/components/studio/StudioRoute'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/** Account-only: signed-out visitors go to sign-in and come back here, query intact. */
export default async function Page({ searchParams }: Props) {
  await requireUser(withQuery('/studio/image', await searchParams))
  return <StudioRoute workflow="image" />
}
