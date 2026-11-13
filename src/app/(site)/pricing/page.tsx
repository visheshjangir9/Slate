import { PricingPage } from '@/components/pages/PricingPage'
import { PRO_PASS } from '@/lib/billing/plans'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: 'Pricing',
  description: `Slate is free to start: one image and fifteen camera moves. Pro adds generative video and more images for ₹${PRO_PASS.amountInr}, a ${PRO_PASS.days}-day pass with no automatic renewal.`,
  path: '/pricing',
})

export default function Page() {
  return <PricingPage />
}
