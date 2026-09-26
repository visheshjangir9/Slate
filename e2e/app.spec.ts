import { expect, test, type Page } from '@playwright/test'

/**
 * End-to-end flows against the credential-free build (see e2e/run.sh).
 * The browser-side mock API stands in for the server's providers and
 * accounts, so every flow is real UI and client state with deterministic
 * backends. "mock-valid-key-0000" is the harness's stand-in key; it is not a
 * credential for anything.
 */
const MOCK_KEY = 'mock-valid-key-0000'

async function noConsoleErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()) })
  return errors
}

test.describe('landing', () => {
  test('hero, BYOK section, and no model catalogue', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Imagine/i)
    const byok = page.locator('#byok')
    await expect(byok).toContainText('Use the models you already have.')
    await expect(byok).toContainText(/Your generation\./i)
    await expect(byok.getByRole('link', { name: /Try BYOK/i })).toHaveAttribute('href', '/byok')
    for (const name of ['Seedance', 'Kling', 'Nano Banana', 'Seedream']) await expect(page.locator('main')).not.toContainText(name)
  })

  test('the wordmark returns to the top of the landing page', async ({ page }) => {
    await page.goto('/#byok')
    await page.evaluate(() => window.scrollTo(0, 3000))
    await page.getByRole('link', { name: 'Slate home' }).click()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    expect(new URL(page.url()).hash).toBe('')
    await expect(page.getByRole('heading', { level: 1 })).toBeInViewport()
  })

  test('the wordmark goes home from an inner page', async ({ page }) => {
    await page.goto('/explore')
    await page.getByRole('link', { name: 'Slate home' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeInViewport()
  })

  test('Features → Popular leads with a bold BYOK entry', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Features/ }).click()
    const entry = page.getByRole('link', { name: /BYOK/ }).first()
    await expect(entry).toHaveAttribute('href', '/byok')
    const weight = await entry.locator('span').first().evaluate((el) => getComputedStyle(el).fontWeight)
    expect(Number(weight)).toBeGreaterThanOrEqual(700)
  })
})

test.describe('every page renders without errors', () => {
  for (const path of ['/', '/explore', '/motion', '/about', '/byok', '/developers', '/assets', '/studio', '/studio/image', '/studio/motion']) {
    test(path, async ({ page }) => {
      const errors = await noConsoleErrors(page)
      const res = await page.goto(path)
      expect(res?.status()).toBeLessThan(400)
      await expect(page.getByRole('link', { name: 'Slate home' })).toBeVisible()
      await page.waitForLoadState('networkidle')
      expect(errors).toEqual([])
    })
  }
})

async function prompt(page: Page, text: string) {
  const box = page.locator('textarea').first()
  await box.fill(text)
}

test.describe('Create Image', () => {
  test('the empty frame shows no stock photo; each prompt gets its own result', async ({ page }) => {
    await page.goto('/studio/image')
    await expect(page.getByText(/Empty frame/i)).toBeVisible()
    await expect(page.locator('section img[src^="/explore/"]')).toHaveCount(0)

    const results: string[] = []
    for (const text of ['A red fox asleep in fresh snow', 'A concrete tower in heavy rain']) {
      await prompt(page, text)
      await page.getByRole('button', { name: /Generate image/i }).click()
      await expect(page.getByText('Current result')).toBeVisible({ timeout: 20_000 })
      const src = await page.locator('section img[src^="data:"]').first().getAttribute('src')
      expect(decodeURIComponent(src!)).toContain(text)
      results.push(src!)
      await expect(page.getByRole('link', { name: /Download/ })).toBeVisible()
      await page.getByRole('button', { name: 'New', exact: true }).first().click()
    }
    expect(results[0]).not.toBe(results[1])
    await expect(page.locator('section img[src^="/explore/"]')).toHaveCount(0)
  })

  test('an unconfigured model is stated, and Generate is disabled', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('slate_mock_image_unconfigured', '1'))
    await page.goto('/studio/image')
    await expect(page.getByText('Not configured')).toBeVisible()
    await expect(page.getByText(/Image generation requires a configured provider/)).toBeVisible()
    await prompt(page, 'A lighthouse in a storm')
    await expect(page.getByRole('button', { name: /Generate image/i })).toBeDisabled()
  })

  test('a failed generation says so and can be retried', async ({ page }) => {
    await page.goto('/studio/image')
    await prompt(page, 'This one should fail [fail]')
    await page.getByRole('button', { name: /Generate image/i }).click()
    await expect(page.getByText('Did not finish')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: /Try again/ }).click()
    await expect(page.getByText(/Current · (rendering|failed)/)).toBeVisible()
  })
})

test.describe('Create Video (LTX-2 Pro)', () => {
  test('text to video renders a playable result', async ({ page }) => {
    await page.goto('/studio')
    await prompt(page, 'Neon street after rain, a cyclist passes')
    await page.getByRole('button', { name: /Generate video/i }).click()
    await expect(page.getByText('Current result')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('section video').first()).toHaveAttribute('src', /\.mp4/)
  })
})

async function connect(page: Page, provider: string | null, key = MOCK_KEY) {
  if (provider) await page.locator('#byok-provider').selectOption(provider)
  await page.locator('#byok-key').fill(key)
  await page.getByRole('button', { name: 'Test connection' }).click()
}

test.describe('BYOK', () => {
  test('a rejected key is an authentication failure, and the key never reaches the DOM', async ({ page }) => {
    await page.goto('/byok')
    await connect(page, 'google', 'wrong-key-123456')
    await expect(page.getByTestId('byok-status')).toContainText('Key rejected')
    await connect(page, null)
    await expect(page.getByTestId('byok-status')).toContainText('Key accepted')
    expect(await page.content()).not.toContain(MOCK_KEY)
    expect(await page.locator('#byok-key').getAttribute('value')).toBe('')
  })

  test('only providers with a real adapter are listed', async ({ page }) => {
    await page.goto('/byok')
    const options = await page.locator('#byok-provider option').allTextContents()
    expect(options.join('|')).not.toMatch(/xAI|Ollama|OpenAI-compatible/)
    expect(options).toEqual(expect.arrayContaining(['Google', 'OpenAI', 'OpenRouter', 'Anthropic', 'Mistral']))
  })

  test('a known model stays the target through connection and is reconciled', async ({ page }) => {
    await page.goto('/byok')
    await page.locator('a[href^="/byok?model=kling-3#"]').click()
    await expect(page.getByTestId('byok-target')).toContainText('Kling 3.0')
    await expect(page.locator('#byok-provider')).toHaveValue('openrouter')
    await expect(page.locator('#byok-provider option', { hasText: 'Google' })).toBeDisabled()
    await expect(page.getByTestId('byok-discovery')).toContainText('No provider models discovered yet.')
    await connect(page, null)
    await expect(page.getByTestId('byok-compat')).toHaveAttribute('data-state', 'supported')
    await expect(page.getByTestId('byok-compat')).toContainText('kwaivgi/kling-v3.0')
    await expect(page.getByTestId('byok-target')).toContainText('Kling 3.0')

    // Another target on the same connection: unsupported, nothing substituted.
    await page.locator('a[href^="/byok?model=seedance-2-5#"]').click()
    await expect(page.getByTestId('byok-target')).toContainText('Seedance 2.5')
    await expect(page.getByTestId('byok-compat')).toHaveAttribute('data-state', 'unavailable')
    await expect(page.getByRole('button', { name: 'Save and use' })).toBeDisabled()

    // Browser back restores the previous target and its result.
    await page.goBack()
    await expect(page.getByTestId('byok-target')).toContainText('Kling 3.0')
    await expect(page.getByTestId('byok-compat')).toHaveAttribute('data-state', 'supported')
  })

  test('a model Slate has no workflow for says so', async ({ page }) => {
    await page.goto('/byok?model=kling-3-motion')
    await expect(page.getByTestId('byok-target')).toContainText(/no motion transfer workflow/i)
    await expect(page.locator('#byok-provider')).toBeDisabled()
  })

  test('connect Google, save Veo, and generate a provider video end to end', async ({ page }) => {
    test.setTimeout(90_000)
    await page.goto('/byok')
    await connect(page, 'google')
    await expect(page.getByTestId('byok-status')).toContainText('Key accepted')
    await expect(page.locator('#byok-model')).toHaveValue('video|veo-3.1-generate-preview')
    await expect(page.getByTestId('byok-capabilities')).toContainText('Runs in Create Video')
    await page.getByRole('button', { name: 'Save and use' }).click()
    await expect(page).toHaveURL(/\/studio\?model=byok/)
    await expect(page.getByText('Connected')).toBeVisible()
    await prompt(page, 'Slow waves on black sand at dusk')
    await page.getByRole('button', { name: /Generate video/i }).click()
    await expect(page.getByText(/Rendering on your Google account/)).toBeVisible()
    await expect(page.getByText('Current result')).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('section video').first()).toHaveAttribute('src', /\.mp4/)
  })

  test('the Studio configuration drawer does not lock the page', async ({ page }) => {
    await page.goto('/studio/image')
    await page.getByRole('button', { name: /All models/ }).click()
    await page.getByRole('button', { name: /Connect your provider/ }).click()
    const drawer = page.getByRole('dialog', { name: 'Bring your own AI' })
    await expect(drawer).toHaveAttribute('aria-modal', 'false')
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
    await page.locator('textarea').first().fill('typed with the drawer open')
    await expect(page.locator('textarea').first()).toHaveValue('typed with the drawer open')
    await page.locator('#byok-provider').selectOption('google')
    await drawer.focus()
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await page.getByRole('button', { name: /All models/ }).click()
    await page.getByRole('button', { name: /Connect your provider/ }).click()
    await expect(page.locator('#byok-provider')).toHaveValue('google')
  })
})

test.describe('mobile @mobile', () => {
  for (const path of ['/', '/byok', '/studio/image']) {
    test(`${path} has no horizontal scroll`, async ({ page }) => {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(1)
    })
  }
})
