import { test, expect } from '@playwright/test'

test('Quick UI test - check if app loads', async ({ page }) => {
  // Navigate to the page
  await page.goto('http://localhost:6173')
  
  // Wait for the page to load
  await page.waitForTimeout(3000)
  
  // Check if main heading exists
  await expect(page.locator('h1')).toContainText('Lumen Transcript Cleaner')
  
  // Check if dark mode toggle exists
  await expect(page.locator('button:has-text("Dark")')).toBeVisible()
  
  // Check if tabs exist
  await expect(page.locator('text=Processing Results')).toBeVisible()
  await expect(page.locator('text=API Calls')).toBeVisible()
  await expect(page.locator('text=Detailed Logs')).toBeVisible()
  await expect(page.locator('text=Configuration')).toBeVisible()
  
  // Take a screenshot for verification
  await page.screenshot({ path: 'test-results/quick-ui-test.png', fullPage: true })
  
  console.log('✅ UI loads correctly with all new features')
})

test('Test dark mode toggle', async ({ page }) => {
  await page.goto('http://localhost:6173')
  await page.waitForTimeout(2000)
  
  // Click dark mode toggle
  await page.click('button:has-text("Dark")')
  await page.waitForTimeout(1000)
  
  // Check if button text changed
  await expect(page.locator('button:has-text("Light")')).toBeVisible()
  
  // Take screenshot of dark mode
  await page.screenshot({ path: 'test-results/dark-mode-test.png', fullPage: true })
  
  console.log('✅ Dark mode toggle works')
})

test('Test logs tab', async ({ page }) => {
  await page.goto('http://localhost:6173')
  await page.waitForTimeout(2000)
  
  // Click on Detailed Logs tab
  await page.click('text=Detailed Logs')
  await page.waitForTimeout(1000)
  
  // Check if logs content is visible
  await expect(page.locator('h3:has-text("Detailed Logs")')).toBeVisible()
  await expect(page.locator('text=entries')).toBeVisible()
  
  console.log('✅ Logs tab works')
})