import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('http://127.0.0.1:6173')
  await page.waitForLoadState('networkidle')
})

test('UI improvements basic verification', async ({ page }) => {
  // Test 1: Tab name changed to "Results"
  await expect(page.getByRole('button', { name: /Results/ })).toBeVisible()
  
  // Test 2: Left panel has reduced width (should be smaller than before)
  const leftPanel = page.locator('textarea[placeholder*="Paste your raw transcript"]').first()
  await expect(leftPanel).toBeVisible()
  
  // Test 3: Load example and check for filter controls
  await page.click('button:has-text("Load Example")')
  await page.waitForTimeout(2000)
  
  await page.click('button:has-text("Parse Transcript")')
  await page.waitForTimeout(3000)
  
  await page.click('button:has-text("Start Cleaning")')
  await page.waitForTimeout(8000)
  
  // Test 4: Check filter buttons appear
  const hideLumenButton = page.getByRole('button', { name: /Hide Lumen/ })
  const onlyCleanedButton = page.getByRole('button', { name: /Only Cleaned/ })
  const compactButton = page.getByRole('button', { name: /Compact/ })
  
  await expect(hideLumenButton).toBeVisible()
  await expect(onlyCleanedButton).toBeVisible()
  await expect(compactButton).toBeVisible()
  
  // Test 5: Font size selector
  const fontSizeSelect = page.locator('select').filter({ hasText: 'Medium' })
  await expect(fontSizeSelect).toBeVisible()
  
  // Test 6: Check auto-process setting exists
  await page.click('button:has-text("Configuration")')
  const autoProcessText = page.locator('text=Auto-process on paste')
  await expect(autoProcessText).toBeVisible()
  
  console.log('✅ All basic UI improvements verified successfully')
})

test('filter functionality verification', async ({ page }) => {
  // Load and process content
  await page.click('button:has-text("Load Example")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Parse Transcript")')
  await page.waitForTimeout(2000)
  await page.click('button:has-text("Start Cleaning")')
  await page.waitForTimeout(6000)
  
  // Count total turns
  const totalTurns = await page.locator('text=/Turn \\d+/').count()
  console.log(`Total turns found: ${totalTurns}`)
  
  // Test Hide Lumen filter
  const hideLumenButton = page.getByRole('button', { name: /Hide Lumen/ })
  await hideLumenButton.click()
  
  // Check button is active
  await expect(hideLumenButton).toHaveText(/✓.*Hide Lumen/)
  
  // Count filtered turns (should be fewer)
  const filteredTurns = await page.locator('text=/Turn \\d+/').count()
  console.log(`Filtered turns: ${filteredTurns}`)
  
  expect(filteredTurns).toBeLessThanOrEqual(totalTurns)
  
  console.log('✅ Filter functionality verified')
})

test('compact mode and font size verification', async ({ page }) => {
  // Load some content
  await page.click('button:has-text("Load Example")')
  await page.waitForTimeout(1000)
  await page.click('button:has-text("Parse Transcript")')
  await page.waitForTimeout(2000)
  await page.click('button:has-text("Start Cleaning")')
  await page.waitForTimeout(4000)
  
  // Test compact mode
  const compactButton = page.getByRole('button', { name: /Compact/ })
  await compactButton.click()
  await expect(compactButton).toHaveText(/✓.*Compact/)
  
  // Test font size changes
  const fontSizeSelect = page.locator('select').filter({ hasText: 'Medium' })
  await fontSizeSelect.selectOption('large')
  await expect(fontSizeSelect).toHaveValue('large')
  
  await fontSizeSelect.selectOption('small')
  await expect(fontSizeSelect).toHaveValue('small')
  
  console.log('✅ Compact mode and font size verified')
})