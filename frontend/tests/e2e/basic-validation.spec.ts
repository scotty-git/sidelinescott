import { test, expect } from '@playwright/test'

test('basic app loads with new features', async ({ page }) => {
  await page.goto('http://127.0.0.1:6173')
  
  // Check main title
  await expect(page.locator('h1')).toContainText('Lumen Transcript Cleaner')
  
  // Check Results tab (not Processing Results)
  const resultsTab = page.locator('button:has-text("Results")')
  await expect(resultsTab).toBeVisible()
  
  console.log('✅ Basic app validation complete - Results tab found')
})