import Link from 'next/link'
import { LegalDocument, type LegalSection } from '@/components/pages/LegalDocument'
import { CookieSettingsButton } from '@/components/consent/CookieSettingsButton'
import { pageMetadata } from '@/lib/metadata'
import { SITE } from '@/lib/site'

export const metadata = pageMetadata({
  title: 'Privacy Policy',
  description: 'What Slate collects, why, where it is stored, who processes it, and how to access or delete your data.',
  path: '/privacy',
})

const SECTIONS: LegalSection[] = [
  {
    id: 'summary',
    title: 'The short version',
    body: (
      <ul>
        <li>We collect what is needed to run your account and keep your work: your email, a hashed password, and the prompts, images and videos you create.</li>
        <li>We do not sell your data, and we do not use advertising or cross-site tracking.</li>
        <li>Analytics run only if you accept them, and they are cookieless and aggregated.</li>
        <li>A provider key you enter for Bring your own AI stays in your browser tab&rsquo;s memory. It is never written to our database or logs.</li>
        <li>You can ask for a copy of your data, or for it to be deleted, at any time.</li>
      </ul>
    ),
  },
  {
    id: 'who',
    title: 'Who is responsible',
    body: (
      <p>
        Slate is built and operated by {SITE.owner} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). For any privacy question or request,
        email <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
      </p>
    ),
  },
  {
    id: 'collect',
    title: 'What we collect',
    body: (
      <>
        <p><strong>Account data.</strong> Your email address and password when you create an account. Passwords are stored hashed by our authentication provider; we never see them in plain text.</p>
        <p><strong>Your creations.</strong> The prompts, settings and reference images you submit, and the images and videos Slate produces for you, so they appear in your History and Assets.</p>
        <p><strong>Technical data.</strong> Standard server logs (IP address, browser type, the page requested, time and status) kept by our hosting provider for security and debugging.</p>
        <p><strong>Usage analytics, only with your consent.</strong> Page views and performance measurements (such as page load time), aggregated and without cookies or a persistent identifier.</p>
        <p><strong>What we do not collect.</strong> No payment details, no precise location, no contacts, and no data from your camera or microphone (the site&rsquo;s permissions policy blocks them).</p>
      </>
    ),
  },
  {
    id: 'use',
    title: 'How we use it',
    body: (
      <ul>
        <li>To provide the service: sign you in, run your generations and keep your library.</li>
        <li>To keep Slate secure: detect abuse, rate-limit automated sign-ups and fix errors.</li>
        <li>To improve Slate, using aggregated analytics if you have allowed them.</li>
        <li>To reply when you contact us.</li>
      </ul>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and local storage',
    body: (
      <>
        <p>Slate uses only what it needs. These are set whatever you choose, because the site cannot work without them:</p>
        <table>
          <thead><tr><th scope="col">Name</th><th scope="col">Purpose</th><th scope="col">Lifetime</th></tr></thead>
          <tbody>
            <tr><td><code>slate_at</code>, <code>slate_rt</code></td><td>Keep you signed in (httpOnly, not readable by scripts)</td><td>7 and 30 days</td></tr>
            <tr><td><code>slate_device</code></td><td>Signed anonymous ID so work started before signing in can move to your account</td><td>1 year</td></tr>
            <tr><td><code>slate_consent</code> (local storage)</td><td>Remembers your cookie choice</td><td>Until you clear it</td></tr>
            <tr><td><code>slate_intro_seen</code>, prompt position (local storage)</td><td>Shortens the homepage intro on return visits; remembers your place in prompt ideas</td><td>Until you clear it</td></tr>
          </tbody>
        </table>
        <p>
          <strong>Optional:</strong> analytics (Vercel Web Analytics and Speed Insights) load only after you choose &ldquo;Accept all&rdquo;.
          They set no cookies. You can change your choice at any time: <CookieSettingsButton className="inline underline underline-offset-4 hover:text-signal" />.
        </p>
      </>
    ),
  },
  {
    id: 'processors',
    title: 'Who processes your data',
    body: (
      <>
        <p>We rely on these services to run Slate. Each receives only what its job needs:</p>
        <ul>
          <li><strong>Vercel</strong>: hosting, server logs and, with consent, analytics.</li>
          <li><strong>Supabase</strong>: database, file storage and sign-in.</li>
          <li><strong>OpenAI</strong>, <strong>Lightricks (LTX)</strong>, <strong>Cloudflare Workers AI</strong> and <strong>Pollinations</strong>: receive your prompt (and reference image, where you supply one) to generate the result.</li>
          <li><strong>Bring your own AI</strong>: when you connect Google, OpenAI or OpenRouter with your own key, your prompt goes to that provider under your own account and their terms.</li>
        </ul>
        <p>An image you add as a source or reference is uploaded to our storage when you choose it, so the model can use it and it can appear in your history. Camera Motion renders the video in your browser and uploads the finished file to your library.</p>
      </>
    ),
  },
  {
    id: 'byok',
    title: 'Your provider keys',
    body: (
      <p>
        A key you enter for <Link href="/byok">Bring your own AI</Link> is held in your browser tab&rsquo;s memory only. It is never saved to
        local storage, cookies, our database or our logs. It is sent to our server only as part of a request you make, forwarded to the
        provider over HTTPS, and discarded. Reloading or closing the tab, or signing out, removes it.
      </p>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <ul>
        <li>Account data and your creations: until you delete them or ask us to delete your account.</li>
        <li>Work made without an account: kept against the anonymous device ID until it moves to your account when you sign in, or until you ask us to delete it.</li>
        <li>Server logs: kept by Vercel for a short period under its own retention policy.</li>
      </ul>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: (
      <>
        <p>
          Depending on where you live (for example under the GDPR, UK GDPR, India&rsquo;s DPDP Act or the CCPA), you can ask to access,
          correct, export or delete your personal data, object to or restrict its use, and withdraw consent at any time. Email{' '}
          <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> and we will reply within 30 days. You may also complain to your
          local data protection authority.
        </p>
        <p>We do not sell or share personal data for cross-context advertising.</p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        All traffic is encrypted with HTTPS, enforced with HSTS. Sessions use httpOnly cookies, secret keys stay on the server, every API
        request is validated, and sign-up and sign-in are rate-limited against automated abuse. No system is perfectly secure; if we learn
        of a breach affecting you, we will tell you promptly.
      </p>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: <p>Slate is not directed at children under 13 (or the minimum age in your country), and we do not knowingly collect their data.</p>,
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: <p>If we change this policy, we will update the date at the top. Significant changes will be announced on the site before they take effect.</p>,
  },
]

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Privacy Policy"
      intro={<p>This policy explains what personal data Slate collects, why, and the choices you have. It applies to this website and the Slate studio.</p>}
      sections={SECTIONS}
      related={{ label: 'Terms and Conditions', href: '/terms' }}
    />
  )
}
