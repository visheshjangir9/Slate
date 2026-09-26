import { redirect } from 'next/navigation'
import { withQuery } from '@/lib/auth/next'

/** Old address. Kept so existing links still land on the sign-in page. */
export default async function LegacyLogin({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(withQuery('/sign-in', await searchParams))
}
