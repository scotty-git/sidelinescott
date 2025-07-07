import { test, expect } from '@playwright/test'

test('simple UI test', async ({ page }) => {
  await page.goto('http://127.0.0.1:6173')
  await page.waitForLoadState('networkidle')
  
  // Check that the page loaded
  await expect(page.locator('h1')).toContainText('Lumen Transcript Cleaner')
  
  // Check for Results tab (renamed from Processing Results)
  await expect(page.getByRole('button', { name: /Results/ })).toBeVisible()
})