import { test, expect } from '@playwright/test'

test.describe('Deep Cleaning Test - Debug Mode', () => {
  test('should perform complete cleaning workflow with detailed debugging', async ({ page }) => {
    // Capture console errors and logs
    const consoleMessages: string[] = []
    const errors: string[] = []
    
    page.on('console', msg => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`)
      if (msg.type() === 'error') errors.push(msg.text())
    })
    
    page.on('response', response => {
      if (!response.ok()) {
        errors.push(`Network error: ${response.status()} ${response.url()}`)
      }
    })
    
    // Navigate to the app
    await page.goto('/')
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'screenshots/debug-01-initial.png',
      fullPage: true 
    })
    
    // Load example script
    await page.click('text=Load Example')
    await page.waitForTimeout(1000)
    
    await page.screenshot({ 
      path: 'screenshots/debug-02-example-loaded.png',
      fullPage: true 
    })
    
    // Parse transcript
    await page.click('text=Parse Transcript')
    await page.waitForTimeout(3000)
    
    await page.screenshot({ 
      path: 'screenshots/debug-03-parsed.png',
      fullPage: true 
    })
    
    // Check if we have parsed turns
    const turnCount = await page.textContent('.text-gray-600:has-text("turns")')
    console.log('Parsed turns:', turnCount)
    
    // Start cleaning
    await page.click('text=Start Cleaning')
    
    // Wait for processing to start
    await page.waitForTimeout(2000)
    await page.screenshot({ 
      path: 'screenshots/debug-04-processing-start.png',
      fullPage: true 
    })
    
    // Wait for some processing
    await page.waitForTimeout(5000)
    await page.screenshot({ 
      path: 'screenshots/debug-05-processing-mid.png',
      fullPage: true 
    })
    
    // Wait for completion
    await page.waitForTimeout(10000)
    await page.screenshot({ 
      path: 'screenshots/debug-06-final.png',
      fullPage: true 
    })
    
    // Check API calls tab
    await page.click('text=API Calls')
    await page.waitForTimeout(1000)
    await page.screenshot({ 
      path: 'screenshots/debug-07-api-calls.png',
      fullPage: true 
    })
    
    // Check Configuration tab
    await page.click('text=Configuration')
    await page.waitForTimeout(1000)
    await page.screenshot({ 
      path: 'screenshots/debug-08-config.png',
      fullPage: true 
    })
    
    // Output debugging info
    console.log('=== CONSOLE MESSAGES ===')
    consoleMessages.forEach(msg => console.log(msg))
    
    console.log('=== ERRORS ===')
    errors.forEach(error => console.log(error))
    
    // Check final API call count
    const apiCallText = await page.textContent('text=API calls')
    console.log('Final API calls:', apiCallText)
  })
})