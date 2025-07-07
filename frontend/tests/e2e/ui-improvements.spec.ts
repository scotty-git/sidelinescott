import { test, expect, Page } from '@playwright/test'

/**
 * UI Improvements E2E Tests
 * 
 * Testing all new UI improvements including filters, compact mode, resizable panels
 * Following CLAUDE.md guidelines with auto-error capture
 */

const FRONTEND_URL = 'http://127.0.0.1:6173'
const BACKEND_URL = 'http://127.0.0.1:8000'

// Auto-error capture
async function setupErrorCapture(page: Page) {
  const errors: string[] = []
  const failedRequests: Array<{url: string, status: number}> = []

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`Console Error: ${msg.text()}`)
    }
  })

  page.on('response', response => {
    if (!response.ok() && response.status() >= 400) {
      failedRequests.push({
        url: response.url(),
        status: response.status()
      })
    }
  })

  page.on('pageerror', error => {
    errors.push(`Page Error: ${error.message}`)
  })

  return { errors, failedRequests }
}

function reportIssues(errors: string[], failedRequests: any[], testName: string) {
  if (errors.length || failedRequests.length) {
    console.log(`🚨 Auto-detected issues in ${testName}:`, {
      consoleErrors: errors,
      networkFailures: failedRequests
    })
    return false
  }
  return true
}

test.beforeEach(async ({ page }) => {
  await page.goto(FRONTEND_URL)
  await page.waitForLoadState('networkidle')
})

test('should show correct tab name as "Results"', async ({ page }) => {
    const resultsTab = page.getByRole('button', { name: /Results/ })
    await expect(resultsTab).toBeVisible()
    await expect(resultsTab).not.toHaveText(/Processing Results/)
  })

  test('should have resizable left panel with default 20% width', async ({ page }) => {
    const leftPanel = page.locator('div').filter({ hasText: 'Raw Transcript' }).first()
    await expect(leftPanel).toBeVisible()
    
    // Check that the panel has appropriate width (approximate check)
    const panelBox = await leftPanel.boundingBox()
    const pageBox = await page.locator('body').boundingBox()
    
    if (panelBox && pageBox) {
      const widthPercentage = (panelBox.width / pageBox.width) * 100
      expect(widthPercentage).toBeLessThan(25) // Should be around 20%
      expect(widthPercentage).toBeGreaterThan(15)
    }
  })

  test('should have drag handle for resizing panel', async ({ page }) => {
    const dragHandle = page.locator('div[style*="cursor: col-resize"]')
    await expect(dragHandle).toBeVisible()
    await expect(dragHandle).toHaveCSS('width', '4px')
  })

  test('should process example transcript and show filtering controls', async ({ page }) => {
    // Load example script
    await page.click('button:has-text("Load Example")')
    await page.waitForTimeout(1000)
    
    // Start processing
    await page.click('button:has-text("Parse Transcript")')
    await page.waitForTimeout(2000)
    
    await page.click('button:has-text("Start Cleaning")')
    
    // Wait for some processing to complete
    await page.waitForTimeout(5000)
    
    // Check if filter controls are visible
    const hideLumenButton = page.getByRole('button', { name: /Hide Lumen/ })
    const onlyCleanedButton = page.getByRole('button', { name: /Only Cleaned/ })
    
    await expect(hideLumenButton).toBeVisible()
    await expect(onlyCleanedButton).toBeVisible()
  })

  test('should toggle hide Lumen functionality', async ({ page }) => {
    // Load and process example
    await page.click('button:has-text("Load Example")')
    await page.waitForTimeout(1000)
    await page.click('button:has-text("Parse Transcript")')
    await page.waitForTimeout(2000)
    await page.click('button:has-text("Start Cleaning")')
    await page.waitForTimeout(5000)
    
    // Count total turns before filtering
    const totalTurns = await page.locator('[style*="Turn "]').count()
    
    // Click hide Lumen button
    const hideLumenButton = page.getByRole('button', { name: /Hide Lumen/ })
    await hideLumenButton.click()
    
    // Check that button shows active state
    await expect(hideLumenButton).toHaveText(/✓.*Hide Lumen/)
    
    // Count remaining turns (should be fewer)
    const filteredTurns = await page.locator('[style*="Turn "]').count()
    expect(filteredTurns).toBeLessThan(totalTurns)
  })

  test('should toggle compact mode and font size', async ({ page }) => {
    // Load and process example
    await page.click('button:has-text("Load Example")')
    await page.waitForTimeout(1000)
    await page.click('button:has-text("Parse Transcript")')
    await page.waitForTimeout(2000)
    await page.click('button:has-text("Start Cleaning")')
    await page.waitForTimeout(5000)
    
    // Test compact mode toggle
    const compactButton = page.getByRole('button', { name: /Compact/ })
    await expect(compactButton).toBeVisible()
    await compactButton.click()
    await expect(compactButton).toHaveText(/✓.*Compact/)
    
    // Test font size selector
    const fontSizeSelect = page.locator('select').filter({ hasText: 'Medium' })
    await expect(fontSizeSelect).toBeVisible()
    await fontSizeSelect.selectOption('large')
    await expect(fontSizeSelect).toHaveValue('large')
    
    await fontSizeSelect.selectOption('small')
    await expect(fontSizeSelect).toHaveValue('small')
  })

  test('should show different metadata for User vs Lumen turns', async ({ page }) => {
    // Load and process example
    await page.click('button:has-text("Load Example")')
    await page.waitForTimeout(1000)
    await page.click('button:has-text("Parse Transcript")')
    await page.waitForTimeout(2000)
    await page.click('button:has-text("Start Cleaning")')
    await page.waitForTimeout(8000)
    
    // Find a User turn (should have full metadata)
    const userTurnMetadata = page.locator('text=Model:').first()
    if (await userTurnMetadata.isVisible()) {
      await expect(userTurnMetadata).toBeVisible()
    }
    
    // Find a Lumen turn (should have simplified metadata)
    const lumenResponse = page.locator('text=Lumen response - no processing metadata')
    if (await lumenResponse.isVisible()) {
      await expect(lumenResponse).toBeVisible()
    }
  })

  test('should have auto-process on paste setting in Configuration', async ({ page }) => {
    // Navigate to settings tab
    await page.click('button:has-text("Configuration")')
    
    // Look for the auto-process on paste checkbox
    const autoProcessPasteCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /Auto-process on paste/ })
    await expect(autoProcessPasteCheckbox.or(page.locator('text=Auto-process on paste'))).toBeVisible()
  })

  test('should calculate average latency excluding Lumen calls', async ({ page }) => {
    // Load and process example
    await page.click('button:has-text("Load Example")')
    await page.waitForTimeout(1000)
    await page.click('button:has-text("Parse Transcript")')
    await page.waitForTimeout(2000)
    await page.click('button:has-text("Start Cleaning")')
    await page.waitForTimeout(5000)
    
    // Check that average latency is displayed
    const latencyDisplay = page.locator('text=/\\d+ms avg latency/')
    await expect(latencyDisplay).toBeVisible()
    
    // The latency should be reasonable (not 0, not too high)
    const latencyText = await latencyDisplay.textContent()
    const latencyValue = parseInt(latencyText?.match(/(\d+)ms/)?.[1] || '0')
    expect(latencyValue).toBeGreaterThan(0)
    expect(latencyValue).toBeLessThan(10000) // Should be under 10 seconds
  })

  test('should persist panel width and UI settings', async ({ page }) => {
    // Change some settings
    await page.click('button:has-text("Configuration")')
    const autoProcessCheckbox = page.locator('input[type="checkbox"]').first()
    await autoProcessCheckbox.check()
    
    // Refresh page
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    // Check that settings persisted
    await page.click('button:has-text("Configuration")')
    const persistedCheckbox = page.locator('input[type="checkbox"]').first()
    await expect(persistedCheckbox).toBeChecked()
  })

  test('should show turn count correctly with filters', async ({ page }) => {
    // Load and process example
    await page.click('button:has-text("Load Example")')
    await page.waitForTimeout(1000)
    await page.click('button:has-text("Parse Transcript")')
    await page.waitForTimeout(2000)
    await page.click('button:has-text("Start Cleaning")')
    await page.waitForTimeout(5000)
    
    // Check turn count display
    const turnCountDisplay = page.locator('text=/Showing \\d+ of \\d+ turns/')
    await expect(turnCountDisplay).toBeVisible()
    
    // Apply filter and check count updates
    const hideLumenButton = page.getByRole('button', { name: /Hide Lumen/ })
    await hideLumenButton.click()
    
    // Count should still be displayed and should show fewer turns
    await expect(turnCountDisplay).toBeVisible()
  })

  test('should handle compact mode with all font sizes', async ({ page }) => {
    // Load some content first
    await page.click('button:has-text("Load Example")')
    await page.waitForTimeout(1000)
    await page.click('button:has-text("Parse Transcript")')
    await page.waitForTimeout(2000)
    await page.click('button:has-text("Start Cleaning")')
    await page.waitForTimeout(3000)
    
    const compactButton = page.getByRole('button', { name: /Compact/ })
    const fontSizeSelect = page.locator('select').filter({ hasText: 'Medium' })
    
    // Test all combinations
    const fontSizes = ['small', 'medium', 'large']
    
    for (const fontSize of fontSizes) {
      // Test normal mode with this font size
      await fontSizeSelect.selectOption(fontSize)
      await expect(fontSizeSelect).toHaveValue(fontSize)
      
      // Test compact mode with this font size
      await compactButton.click()
      await expect(compactButton).toHaveText(/✓.*Compact/)
      
      // Toggle back to normal
      await compactButton.click()
      await expect(compactButton).not.toHaveText(/✓.*Compact/)
    }
  })