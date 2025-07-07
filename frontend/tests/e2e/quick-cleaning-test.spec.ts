import { test, expect } from '@playwright/test'

test('Quick cleaning error detection', async ({ page }) => {
  // Capture any console errors or alerts
  const consoleErrors = []
  const consoleMessages = []
  let alertMessage = null
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`)
  })
  
  page.on('dialog', async dialog => {
    alertMessage = dialog.message()
    console.log(`Alert detected: ${alertMessage}`)
    await dialog.accept()
  })
  
  await page.goto('http://localhost:6173')
  await page.waitForTimeout(2000)
  
  // Use a very simple transcript for testing
  await page.fill('textarea', `User
Hello there
AI  
Hi! How can I help?`)
  
  console.log('Step 1: Parse simple transcript')
  await page.click('button:has-text("Parse Transcript")')
  await page.waitForTimeout(2000)
  
  console.log('Step 2: Start cleaning and wait for error/success')
  await page.click('button:has-text("Start Cleaning")')
  await page.waitForTimeout(5000)
  
  // Check detailed logs for error information
  await page.click('button:has-text("Detailed Logs")')
  await page.waitForTimeout(1000)
  
  // Take screenshot of logs
  await page.screenshot({ path: 'test-results/error-logs.png', fullPage: true })
  
  // Output captured information
  console.log('\\n=== ALERT MESSAGE ===')
  console.log(alertMessage || 'No alert detected')
  
  console.log('\\n=== CONSOLE ERRORS ===')
  consoleErrors.forEach(error => console.log(error))
  
  console.log('\\n=== ALL CONSOLE MESSAGES ===')
  consoleMessages.slice(-10).forEach(msg => console.log(msg)) // Last 10 messages
  
  // Check if we have results or still have "No results yet"
  const hasResults = await page.locator('text=ORIGINAL → GEMINI').count()
  const noResults = await page.locator('text=No results yet').count()
  
  console.log(`\\nResults check: hasResults=${hasResults}, noResults=${noResults}`)
})