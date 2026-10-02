import Link from 'next/link'
import { LegalDocument, type LegalSection } from '@/components/pages/LegalDocument'
import { pageMetadata } from '@/lib/metadata'
import { SITE } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Terms and Conditions',
  description: 'The rules for using Slate: your account, what you may create, who owns the results, and the limits of our responsibility.',
  path: '/terms',
})

const SECTIONS: LegalSection[] = [
  {
    id: 'agreement',
    title: 'Agreement',
    body: (
      <p>
        By using Slate you agree to these terms and to our <Link href="/privacy">Privacy Policy</Link>. If you do not agree, please do not
        use the service. Slate is operated by {SITE.owner}.
      </p>
    ),
  },
  {
    id: 'service',
    title: 'The service',
    body: (
      <p>
        Slate is a creative studio for generating images and videos with AI models and applying camera moves to images. Features, models
        and limits may change, and a model can become unavailable when its provider changes or withdraws it. Slate is currently provided
        free of charge, as is, and may be paused or discontinued.
      </p>
    ),
  },
  {
    id: 'account',
    title: 'Your account',
    body: (
      <ul>
        <li>You must be at least 13 years old, or the minimum age to consent in your country, to create an account.</li>
        <li>Give a real email address and keep your password secret. You are responsible for activity under your account.</li>
        <li>One person per account; automated or bulk account creation is not allowed.</li>
        <li>Tell us promptly at <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> if you think your account has been misused.</li>
      </ul>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <>
        <p>You must not use Slate to create, upload or share content that:</p>
        <ul>
          <li>is illegal, or sexualises minors in any way;</li>
          <li>depicts a real person in a sexual, defamatory or deceptive way, or impersonates someone without their consent;</li>
          <li>harasses, threatens or promotes violence or hatred against people or groups;</li>
          <li>infringes someone else&rsquo;s copyright, trademark, privacy or other rights;</li>
          <li>is designed to mislead people about real events (for example fabricated news footage presented as genuine).</li>
        </ul>
        <p>
          You also must not attack, overload, scrape or reverse-engineer the service, get around rate limits or bot protection, or use it
          to break any AI provider&rsquo;s own usage policies. We may remove content and suspend accounts that break these rules.
        </p>
      </>
    ),
  },
  {
    id: 'content',
    title: 'Your content and ownership',
    body: (
      <>
        <p>
          You keep whatever rights you have in the prompts and images you submit. As between you and Slate, you own the outputs you
          generate, subject to the terms of the model provider that produced them and to any rights others hold in material you supplied.
        </p>
        <p>
          You give us a limited licence to store, process and display your content only as needed to run the service for you. We do not
          use your content to train models and do not publish it.
        </p>
        <p>
          AI output can be inaccurate, unexpected or similar to existing works. Check it before relying on it or using it commercially,
          and do not present AI-generated media as real footage where that could mislead.
        </p>
      </>
    ),
  },
  {
    id: 'byok',
    title: 'Bring your own AI',
    body: (
      <p>
        When you connect your own provider key, generations run on your provider account. You are responsible for that account, its
        charges and compliance with its terms. Slate does not store your key (see the <Link href="/privacy#byok">Privacy Policy</Link>).
      </p>
    ),
  },
  {
    id: 'ip',
    title: 'Slate’s property',
    body: (
      <p>
        The Slate name, design, code and the curated example media on this site belong to their respective owners and are not licensed to
        you except to use the service.
      </p>
    ),
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers',
    body: (
      <p>
        Slate is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind, including fitness for a particular
        purpose, availability or that results will meet your expectations. Keep your own copies of anything important: we do not guarantee
        that stored files will be retained.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    body: (
      <p>
        To the extent the law allows, we are not liable for indirect, incidental or consequential losses, or for loss of data, profits or
        goodwill, arising from your use of Slate. Because the service is free, our total liability to you is limited to INR 1,000 (or
        the equivalent in your currency). Nothing here limits liability that cannot be limited by law.
      </p>
    ),
  },
  {
    id: 'termination',
    title: 'Ending your use',
    body: (
      <p>
        You can stop using Slate at any time and ask us to delete your account. We may suspend or close an account that breaks these
        terms or puts the service or other people at risk, telling you why where we reasonably can.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    body: (
      <p>
        These terms are governed by the laws of India, without prejudice to any mandatory consumer protections of the country you live in.
        We would always rather resolve a problem directly, so please email us first.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <p>
        We may update these terms as Slate changes. We will update the date at the top, and announce material changes on the site before
        they take effect. Continuing to use Slate after that means you accept the new terms.
      </p>
    ),
  },
]

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Terms and Conditions"
      intro={<p>These terms set out the rules for using Slate. They are written to be read: if anything is unclear, ask us.</p>}
      sections={SECTIONS}
      related={{ label: 'Privacy Policy', href: '/privacy' }}
    />
  )
}
