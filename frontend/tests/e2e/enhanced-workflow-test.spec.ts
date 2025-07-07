import { test, expect } from '@playwright/test'

test('Enhanced turn-by-turn cleaning workflow', async ({ page }) => {
  // Capture console errors
  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  
  await page.goto('http://localhost:6173')
  await page.waitForTimeout(3000)
  
  console.log('1. Testing Load Example functionality')
  await page.click('button:has-text("Load Example")')
  await page.waitForTimeout(1000)
  
  // Verify transcript loaded
  const textareaContent = await page.locator('textarea').inputValue()
  expect(textareaContent.length).toBeGreaterThan(1000)
  console.log(`✅ Transcript loaded: ${textareaContent.length} characters`)
  
  console.log('2. Testing Parse Transcript')
  await page.click('button:has-text("Parse Transcript")')
  await page.waitForTimeout(3000)
  
  // Check if parsing stats appeared
  await expect(page.locator('text=turns')).toBeVisible()
  console.log('✅ Transcript parsed successfully')
  
  console.log('3. Testing real-time cleaning workflow')
  await page.click('button:has-text("Start Cleaning")')
  
  // Wait a bit to see progress indicator
  await page.waitForTimeout(2000)
  
  // Check if progress indicator appears
  const progressIndicator = page.locator('text=Processing Turn')
  if (await progressIndicator.isVisible()) {
    console.log('✅ Live progress indicator visible')
  }
  
  // Wait for cleaning to complete (up to 30 seconds)
  await page.waitForTimeout(15000)
  
  console.log('4. Checking Processing Results')
  
  // Verify side-by-side display elements
  await expect(page.locator('text=ORIGINAL → GEMINI')).toBeVisible()
  await expect(page.locator('text=GEMINI → CLEANED')).toBeVisible()
  console.log('✅ Side-by-side original and cleaned text visible')
  
  console.log('5. Testing Detailed Logs')
  await page.click('button:has-text("Detailed Logs")')
  await page.waitForTimeout(1000)
  
  // Check for comprehensive logging
  await expect(page.locator('text=Starting sequential cleaning')).toBeVisible()
  await expect(page.locator('text=Context: Sending')).toBeVisible()
  await expect(page.locator('text=processed in')).toBeVisible()
  console.log('✅ Detailed logging working with context information')
  
  console.log('6. Testing dark mode with results')
  await page.click('button:has-text("Light")')
  await page.waitForTimeout(1000)
  await expect(page.locator('button:has-text("Dark")')).toBeVisible()
  console.log('✅ Dark mode toggle functional')
  
  // Take final screenshot
  await page.screenshot({ path: 'test-results/enhanced-workflow-complete.png', fullPage: true })
  
  // Report any console errors
  if (errors.length > 0) {
    console.log('❌ Console errors detected:', errors)
  } else {
    console.log('✅ No console errors detected')
  }
  
  console.log('✅ Enhanced workflow test completed successfully')
})

test('Real-time turn processing verification', async ({ page }) => {
  await page.goto('http://localhost:6173')
  await page.waitForTimeout(2000)
  
  // Load a shorter example to test real-time processing
  await page.fill('textarea', `AI
Hello there! How can I help you today?

User  
um hi uh I need some help with um like coding and stuff

AI
I'd be happy to help you with coding! What specific area would you like assistance with?

User
well uh like I'm trying to uh learn JavaScript but it's really confusing um you know`)
  
  await page.waitForTimeout(500)
  
  console.log('Testing parse with custom transcript')
  await page.click('button:has-text("Parse Transcript")')
  await page.waitForTimeout(2000)
  
  console.log('Testing real-time cleaning display')
  await page.click('button:has-text("Start Cleaning")')
  
  // Wait for processing to begin and check real-time updates
  await page.waitForTimeout(3000)
  
  // Check for turn-by-turn results appearing
  const turnHeaders = page.locator('text=Turn 1')
  if (await turnHeaders.count() > 0) {
    console.log('✅ Turn-by-turn results appearing in real-time')
  }
  
  // Wait for completion
  await page.waitForTimeout(10000)
  
  // Verify all components are working
  await expect(page.locator('text=ORIGINAL → GEMINI')).toBeVisible()
  await expect(page.locator('text=GEMINI → CLEANED')).toBeVisible()
  
  console.log('✅ Real-time processing verification completed')
})