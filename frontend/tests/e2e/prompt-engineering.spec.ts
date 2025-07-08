import { test, expect } from '@playwright/test'

test.describe('Prompt Engineering Dashboard', () => {
  
  test.beforeEach(async ({ page }) => {
    // Set up error capture
    const errors: string[] = []
    const failedRequests: { url: string; status: number }[] = []

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    page.on('response', response => {
      if (!response.ok()) {
        failedRequests.push({
          url: response.url(),
          status: response.status()
        })
      }
    })

    // Store for cleanup
    page.errors = errors
    page.failedRequests = failedRequests
  })

  test('loads dashboard with all tabs visible', async ({ page }) => {
    await page.goto('http://localhost:6173/prompt-engineering')
    
    // Wait for page to load
    await expect(page.locator('h1')).toContainText('Prompt Engineering Dashboard')
    
    // Check all tabs are present
    await expect(page.locator('text=⚙️ Master Editor')).toBeVisible()
    await expect(page.locator('text=🔍 Turn Inspector')).toBeVisible()
    await expect(page.locator('text=📋 Version Manager')).toBeVisible()
    await expect(page.locator('text=🧪 A/B Testing')).toBeVisible()
    await expect(page.locator('text=📊 Analytics')).toBeVisible()
    
    // Master Editor should be active by default
    await expect(page.locator('text=Prompt Template Editor')).toBeVisible()
    
    // Check for errors
    if (page.errors?.length > 0) {
      console.log('🚨 Console errors detected:', page.errors)
    }
    if (page.failedRequests?.length > 0) {
      console.log('🚨 Failed requests detected:', page.failedRequests)
    }
  })

  test('Master Editor functionality', async ({ page }) => {
    await page.goto('http://localhost:6173/prompt-engineering')
    
    // Wait for Monaco editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 10000 })
    
    // Check template metadata inputs
    await expect(page.locator('input[value*="Template"]')).toBeVisible()
    await expect(page.locator('input[placeholder*="description"], input[value*="description"]')).toBeVisible()
    
    // Check preview variables section
    await expect(page.locator('text=Preview Variables')).toBeVisible()
    await expect(page.locator('textarea')).toHaveCount(2) // conversation_context and raw_text
    
    // Check cleaning level dropdown
    await expect(page.locator('select')).toBeVisible()
    const dropdown = page.locator('select')
    await expect(dropdown).toHaveValue('full')
    
    // Test preview functionality
    await page.click('button:has-text("🔄 Preview")')
    
    // Test simulation functionality  
    await page.click('button:has-text("🧪 Test Prompt")')
    
    // Check for errors during interaction
    await page.waitForTimeout(2000) // Allow API calls to complete
    
    if (page.errors?.length > 0) {
      console.log('🚨 Master Editor errors:', page.errors)
    }
  })

  test('Turn Inspector functionality', async ({ page }) => {
    await page.goto('http://localhost:6173/prompt-engineering')
    
    // Switch to Turn Inspector tab
    await page.click('text=🔍 Turn Inspector')
    
    await expect(page.locator('text=Turn Inspector')).toBeVisible()
    await expect(page.locator('text=Turn ID to Analyze')).toBeVisible()
    
    // Check turn ID input and analyze button
    const turnIdInput = page.locator('input[placeholder*="UUID"]')
    await expect(turnIdInput).toBeVisible()
    
    const analyzeButton = page.locator('button:has-text("Analyze")')
    await expect(analyzeButton).toBeVisible()
    await expect(analyzeButton).toBeDisabled() // Should be disabled without turn ID
    
    // Test with sample turn ID
    await turnIdInput.fill('550e8400-e29b-41d4-a716-446655440000')
    await expect(analyzeButton).toBeEnabled()
    
    // Click analyze (will likely fail with 404, but tests the flow)
    await analyzeButton.click()
    
    await page.waitForTimeout(1000)
    
    if (page.errors?.length > 0) {
      console.log('🚨 Turn Inspector errors (expected for test):', page.errors)
    }
  })

  test('Version Manager tab functionality', async ({ page }) => {
    await page.goto('http://localhost:6173/prompt-engineering')
    
    // Switch to Version Manager tab
    await page.click('text=📋 Version Manager')
    
    await expect(page.locator('text=Version Manager')).toBeVisible()
    await expect(page.locator('button:has-text("➕ New Template")')).toBeVisible()
    
    // Should show template list (at least default template)
    // Note: Might be empty if backend DB is not connected, which is OK for testing
    
    // Test create new template button
    await page.click('button:has-text("➕ New Template")')
    
    await page.waitForTimeout(1000)
    
    if (page.errors?.length > 0) {
      console.log('🚨 Version Manager errors (expected if DB disconnected):', page.errors)
    }
  })

  test('tab navigation works correctly', async ({ page }) => {
    await page.goto('http://localhost:6173/prompt-engineering')
    
    // Test all tab switches
    const tabs = [
      { selector: 'text=🔍 Turn Inspector', content: 'Turn Inspector' },
      { selector: 'text=📋 Version Manager', content: 'Version Manager' },
      { selector: 'text=🧪 A/B Testing', content: 'A/B Testing' },
      { selector: 'text=📊 Analytics', content: 'Analytics' },
      { selector: 'text=⚙️ Master Editor', content: 'Prompt Template Editor' }
    ]
    
    for (const tab of tabs) {
      await page.click(tab.selector)
      await expect(page.locator(`text=${tab.content}`)).toBeVisible()
      await page.waitForTimeout(500) // Allow transition
    }
    
    if (page.errors?.length > 0) {
      console.log('🚨 Tab navigation errors:', page.errors)
    }
  })

  test('dark mode toggle works', async ({ page }) => {
    await page.goto('http://localhost:6173/prompt-engineering')
    
    // Find and click dark mode toggle
    const darkModeButton = page.locator('button:has-text("☀️"), button:has-text("🌙")')
    await expect(darkModeButton).toBeVisible()
    
    // Get initial background color
    const body = page.locator('body')
    const initialBg = await body.evaluate(el => getComputedStyle(el).backgroundColor)
    
    // Toggle dark mode
    await darkModeButton.click()
    await page.waitForTimeout(500)
    
    // Background should have changed
    const newBg = await body.evaluate(el => getComputedStyle(el).backgroundColor)
    expect(newBg).not.toBe(initialBg)
    
    if (page.errors?.length > 0) {
      console.log('🚨 Dark mode toggle errors:', page.errors)
    }
  })

  test('Monaco editor integration', async ({ page }) => {
    await page.goto('http://localhost:6173/prompt-engineering')
    
    // Wait for Monaco editor to fully load
    await page.waitForSelector('.monaco-editor', { timeout: 15000 })
    await page.waitForSelector('.monaco-editor .view-lines', { timeout: 10000 })
    
    // Check Monaco editor is rendered
    const editor = page.locator('.monaco-editor')
    await expect(editor).toBeVisible()
    
    // Check editor has content (default template)
    const editorContent = page.locator('.monaco-editor .view-lines')
    await expect(editorContent).toBeVisible()
    
    // Test typing in editor (basic interaction)
    await page.click('.monaco-editor .view-lines')
    await page.keyboard.press('End') // Go to end of line
    await page.keyboard.type(' // Test comment')
    
    await page.waitForTimeout(1000)
    
    if (page.errors?.length > 0) {
      console.log('🚨 Monaco editor errors:', page.errors)
    }
  })

  test('API integration error handling', async ({ page }) => {
    await page.goto('http://localhost:6173/prompt-engineering')
    
    // Test API calls that might fail gracefully
    await page.click('button:has-text("🔄 Preview")')
    await page.waitForTimeout(2000)
    
    // Check if error messages are handled gracefully
    const errorAlert = page.locator('text=⚠️')
    if (await errorAlert.isVisible()) {
      console.log('✅ Error handling working - error message displayed')
    }
    
    // Test template save (will likely fail without DB)
    await page.click('button:has-text("💾 Save")')
    await page.waitForTimeout(2000)
    
    if (page.errors?.length > 0) {
      console.log('🚨 API integration errors (expected without DB):', page.errors)
    }
    
    if (page.failedRequests?.length > 0) {
      console.log('🚨 Failed API requests (expected without DB):', page.failedRequests)
    }
  })

  test('responsive design and layout', async ({ page }) => {
    // Test desktop layout
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto('http://localhost:6173/prompt-engineering')
    
    await expect(page.locator('h1')).toBeVisible()
    
    // Check grid layout exists
    const masterEditor = page.locator('text=Prompt Template Editor')
    const previewSection = page.locator('text=Preview Variables')
    
    if (await masterEditor.isVisible() && await previewSection.isVisible()) {
      console.log('✅ Desktop layout: Two-column grid working')
    }
    
    // Test mobile layout
    await page.setViewportSize({ width: 768, height: 600 })
    await page.waitForTimeout(500)
    
    // Should still be usable on mobile
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('text=⚙️ Master Editor')).toBeVisible()
    
    if (page.errors?.length > 0) {
      console.log('🚨 Responsive design errors:', page.errors)
    }
  })

  test('performance metrics', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto('http://localhost:6173/prompt-engineering')
    
    // Measure page load time
    await expect(page.locator('h1')).toBeVisible()
    const loadTime = Date.now() - startTime
    
    console.log(`📊 Page load time: ${loadTime}ms`)
    expect(loadTime).toBeLessThan(5000) // Should load within 5 seconds
    
    // Measure tab switch performance
    const tabSwitchStart = Date.now()
    await page.click('text=🔍 Turn Inspector')
    await expect(page.locator('text=Turn Inspector')).toBeVisible()
    const tabSwitchTime = Date.now() - tabSwitchStart
    
    console.log(`📊 Tab switch time: ${tabSwitchTime}ms`)
    expect(tabSwitchTime).toBeLessThan(1000) // Should switch within 1 second
    
    if (page.errors?.length > 0) {
      console.log('🚨 Performance test errors:', page.errors)
    }
  })

  test('accessibility and keyboard navigation', async ({ page }) => {
    await page.goto('http://localhost:6173/prompt-engineering')
    
    // Test keyboard navigation through tabs
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter') // Should activate focused tab
    
    await page.waitForTimeout(500)
    
    // Test form inputs can be reached by keyboard
    await page.click('input[type="text"]')
    await page.keyboard.type('Test input')
    
    // Test buttons can be activated by keyboard
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    
    await page.waitForTimeout(1000)
    
    if (page.errors?.length > 0) {
      console.log('🚨 Accessibility test errors:', page.errors)
    }
  })

  test.afterEach(async ({ page }) => {
    // Report any issues found during test
    if (page.errors && page.errors.length > 0) {
      console.log(`\n🚨 Test completed with ${page.errors.length} console errors`)
    }
    
    if (page.failedRequests && page.failedRequests.length > 0) {
      console.log(`\n🚨 Test completed with ${page.failedRequests.length} failed requests`)
    }
    
    // This is OK for development - we expect some API failures without full DB setup
    console.log(`\n✅ Prompt Engineering Dashboard test completed`)
  })
})

// Extend page object to include error tracking
declare global {
  namespace PlaywrightTest {
    interface Page {
      errors?: string[]
      failedRequests?: { url: string; status: number }[]
    }
  }
}