import { test, expect } from '@playwright/test'

test('Debug cleaning process step by step', async ({ page }) => {
  // Capture all console messages and network requests
  const consoleMessages = []
  const networkRequests = []
  const networkResponses = []
  
  page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`)
  })
  
  page.on('request', request => {
    networkRequests.push(`${request.method()} ${request.url()}`)
  })
  
  page.on('response', response => {
    networkResponses.push(`${response.status()} ${response.url()}`)
  })
  
  await page.goto('http://localhost:6173')
  await page.waitForTimeout(3000)
  
  console.log('=== STEP 1: Load Example ===')
  await page.click('button:has-text("Load Example")')
  await page.waitForTimeout(1000)
  
  const textareaContent = await page.locator('textarea').inputValue()
  console.log(`Textarea content: ${textareaContent.length} characters`)
  
  console.log('=== STEP 2: Parse Transcript ===')
  await page.click('button:has-text("Parse Transcript")')
  await page.waitForTimeout(3000)
  
  // Check for parsing success
  const parseResult = await page.locator('text=turns').textContent()
  console.log(`Parse result: ${parseResult}`)
  
  console.log('=== STEP 3: Check API Calls Tab ===')
  await page.click('button:has-text("API Calls")')
  await page.waitForTimeout(1000)
  
  // Take screenshot of API calls
  await page.screenshot({ path: 'test-results/debug-api-calls.png' })
  
  console.log('=== STEP 4: Check Detailed Logs ===')
  await page.click('button:has-text("Detailed Logs")')
  await page.waitForTimeout(1000)
  
  // Take screenshot of logs
  await page.screenshot({ path: 'test-results/debug-logs.png' })
  
  console.log('=== STEP 5: Start Cleaning (Debug) ===')
  await page.click('text=Processing Results')
  await page.waitForTimeout(500)
  
  // Start cleaning and monitor closely
  await page.click('button:has-text("Start Cleaning")')
  console.log('Start Cleaning button clicked')
  
  // Wait and check for progress
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(2000)
    
    // Check if processing indicator appears
    const processingText = await page.locator('text=Processing Turn').count()
    if (processingText > 0) {
      console.log(`Processing indicator found at ${i * 2}s`)
      break
    }
    
    // Check for any errors or results
    const noResults = await page.locator('text=No results yet').count()
    const hasResults = await page.locator('text=ORIGINAL → GEMINI').count()
    
    console.log(`Check ${i + 1}: No results: ${noResults}, Has results: ${hasResults}`)
    
    if (hasResults > 0) {
      console.log('✅ Results appeared!')
      break
    }
  }
  
  // Take final screenshot
  await page.screenshot({ path: 'test-results/debug-final-state.png', fullPage: true })
  
  // Output all captured data
  console.log('\\n=== CONSOLE MESSAGES ===')
  consoleMessages.forEach(msg => console.log(msg))
  
  console.log('\\n=== NETWORK REQUESTS ===')
  networkRequests.forEach(req => console.log(req))
  
  console.log('\\n=== NETWORK RESPONSES ===') 
  networkResponses.forEach(res => console.log(res))
  
  console.log('\\n=== DEBUG TEST COMPLETED ===')
})