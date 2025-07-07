import { test, expect } from '@playwright/test'

test('Test full cleaning workflow', async ({ page }) => {
  await page.goto('http://localhost:6173')
  await page.waitForTimeout(3000)
  
  // Load example transcript
  await page.click('button:has-text("Load Example")')
  await page.waitForTimeout(1000)
  
  // Parse transcript
  await page.click('button:has-text("Parse Transcript")')
  await page.waitForTimeout(3000)
  
  // Start cleaning
  await page.click('button:has-text("Start Cleaning")')
  await page.waitForTimeout(8000) // Give time for API calls
  
  // Check if results appeared
  const processingResults = page.locator('text=Processing Results')
  await expect(processingResults).toBeVisible()
  
  // Check API Calls tab
  await page.click('button:has-text("API Calls")')
  await page.waitForTimeout(1000)
  
  // Should see API call entries
  await expect(page.locator('text=API call')).toBeVisible()
  
  // Check Detailed Logs tab
  await page.click('button:has-text("Detailed Logs")')
  await page.waitForTimeout(1000)
  
  // Should see log entries
  await expect(page.locator('h3:has-text("Detailed Logs")')).toBeVisible()
  
  // Test dark mode during workflow
  await page.click('button:has-text("Light")')
  await page.waitForTimeout(1000)
  
  // Take final screenshot
  await page.screenshot({ path: 'test-results/full-workflow-dark.png', fullPage: true })
  
  console.log('✅ Full workflow completed successfully')
})