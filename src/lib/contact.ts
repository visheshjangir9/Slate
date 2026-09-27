/**
 * The maker's contact details, shown on /contact. A channel set to null is
 * simply not shown, so the page never carries a dead link.
 */
export interface ContactChannel {
  id: 'email' | 'github' | 'linkedin' | 'instagram'
  label: string
  handle: string
  href: string
}

export const CONTACT = {
  name: 'Vishesh Jangir',
  email: 'visheshjangir026@gmail.com',
  github: 'https://github.com/visheshjangir9',
  linkedin: 'https://www.linkedin.com/in/vishesh-jangir-274969291/' as string | null,
  instagram: 'https://www.instagram.com/vedicaai/' as string | null,
}

const handleOf = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')

export const CONTACT_CHANNELS: ContactChannel[] = [
  { id: 'email' as const, label: 'Email', handle: CONTACT.email, href: `mailto:${CONTACT.email}` },
  CONTACT.linkedin && { id: 'linkedin' as const, label: 'LinkedIn', handle: 'in/vishesh-jangir', href: CONTACT.linkedin },
  CONTACT.instagram && { id: 'instagram' as const, label: 'Instagram', handle: '@vedicaai', href: CONTACT.instagram },
  CONTACT.github && { id: 'github' as const, label: 'GitHub', handle: handleOf(CONTACT.github), href: CONTACT.github },
].filter((c): c is ContactChannel => Boolean(c))
