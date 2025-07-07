import { test, expect } from '@playwright/test'

test.describe('Professional Developer Tool UI', () => {
  test('should show complete developer interface with all details', async ({ page }) => {
    // Navigate to the dev tool
    await page.goto('/')
    
    // Take screenshot of initial state
    await page.screenshot({ 
      path: 'screenshots/dev-01-initial.png',
      fullPage: true 
    })
    
    // Load example script
    await page.click('text=Load Example')
    await page.waitForTimeout(1000)
    
    await page.screenshot({ 
      path: 'screenshots/dev-02-example-loaded.png',
      fullPage: true 
    })
    
    // Parse transcript
    await page.click('text=Parse Transcript')
    await page.waitForTimeout(2000)
    
    await page.screenshot({ 
      path: 'screenshots/dev-03-parsed.png',
      fullPage: true 
    })
    
    // Start cleaning
    await page.click('text=Start Cleaning')
    
    // Wait a bit for processing to start
    await page.waitForTimeout(1000)
    await page.screenshot({ 
      path: 'screenshots/dev-04-processing.png',
      fullPage: true 
    })
    
    // Wait for processing to complete
    await page.waitForTimeout(15000)
    await page.screenshot({ 
      path: 'screenshots/dev-05-complete.png',
      fullPage: true 
    })
  })

  test('should show API call details', async ({ page }) => {
    await page.goto('/')
    
    // Load example and parse
    await page.click('text=Load Example')
    await page.waitForTimeout(1000)
    await page.click('text=Parse Transcript')
    await page.waitForTimeout(2000)
    
    // Should have API calls visible
    await page.screenshot({ 
      path: 'screenshots/dev-api-calls.png',
      fullPage: true 
    })
  })

  test('should handle direct copy-paste workflow', async ({ page }) => {
    await page.goto('/')
    
    // Test direct paste
    const testTranscript = `AI

Hello there, this is a test transcript with <noise> and foreign text อ

User

Yes, I can hear you clearly.`

    await page.fill('textarea', testTranscript)
    await page.waitForTimeout(500)
    
    await page.screenshot({ 
      path: 'screenshots/dev-copy-paste.png',
      fullPage: true 
    })
    
    await page.click('text=Parse Transcript')
    await page.waitForTimeout(2000)
    
    await page.screenshot({ 
      path: 'screenshots/dev-paste-parsed.png',
      fullPage: true 
    })
  })
})