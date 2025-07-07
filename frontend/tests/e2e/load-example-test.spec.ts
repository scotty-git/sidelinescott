import { test, expect } from '@playwright/test'

test('Test Load Example functionality', async ({ page }) => {
  await page.goto('http://localhost:6173')
  await page.waitForTimeout(3000)
  
  // Check if Load Example button exists
  await expect(page.locator('button:has-text("Load Example")')).toBeVisible()
  
  // Click Load Example button
  await page.click('button:has-text("Load Example")')
  await page.waitForTimeout(1000)
  
  // Check if text was loaded into textarea
  const textareaContent = await page.locator('textarea').inputValue()
  console.log('Textarea content length:', textareaContent.length)
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/load-example-test.png', fullPage: true })
  
  expect(textareaContent.length).toBeGreaterThan(0)
  console.log('✅ Load Example works')
})