import { ContactPage } from '@/components/pages/ContactPage'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: 'Contact',
  description: 'Get in touch with the maker of Slate about questions, feedback or collaboration, by email, LinkedIn, Instagram or GitHub.',
  path: '/contact',
})

export default function Page() {
  return <ContactPage />
}
