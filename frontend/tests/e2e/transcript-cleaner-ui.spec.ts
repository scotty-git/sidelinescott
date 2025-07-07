import { test, expect } from '@playwright/test'

test.describe('Transcript Cleaner UI/UX Testing', () => {
  test('should capture screenshots of all workflow steps', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://127.0.0.1:6173')
    
    // Take screenshot of landing page (upload step)
    await page.screenshot({ 
      path: 'screenshots/01-landing-upload.png',
      fullPage: true 
    })
    
    // Test "Try Example Conversation" button
    await page.click('text=Try Example Conversation')
    
    // Wait for content to load and take screenshot of parse step
    await page.waitForTimeout(1000)
    await page.screenshot({ 
      path: 'screenshots/02-parse-step.png',
      fullPage: true 
    })
    
    // Click Parse Transcript
    await page.click('text=Parse Transcript')
    
    // Wait for parsing to complete
    await page.waitForTimeout(2000)
    await page.screenshot({ 
      path: 'screenshots/03-clean-step.png',
      fullPage: true 
    })
    
    // Click Start AI Cleaning
    await page.click('text=Start AI Cleaning')
    
    // Wait for processing to start
    await page.waitForTimeout(1000)
    await page.screenshot({ 
      path: 'screenshots/04-processing.png',
      fullPage: true 
    })
    
    // Wait for processing to complete (this might take a while with real AI)
    await page.waitForSelector('text=Download Cleaned Transcript', { timeout: 60000 })
    await page.screenshot({ 
      path: 'screenshots/05-export-step.png',
      fullPage: true 
    })
    
    // Test advanced mode
    await page.click('text=Show Advanced')
    await page.screenshot({ 
      path: 'screenshots/06-advanced-mode.png',
      fullPage: true 
    })
  })

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.goto('http://127.0.0.1:6173')
    
    await page.screenshot({ 
      path: 'screenshots/mobile-01-landing.png',
      fullPage: true 
    })
    
    // Test mobile navigation
    await page.click('text=Try Example Conversation')
    await page.waitForTimeout(1000)
    
    await page.screenshot({ 
      path: 'screenshots/mobile-02-parse.png',
      fullPage: true 
    })
  })

  test('should have proper error handling', async ({ page }) => {
    const errors: string[] = []
    const networkFailures: any[] = []
    
    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    // Capture network failures
    page.on('response', response => {
      if (!response.ok()) {
        networkFailures.push({
          url: response.url(),
          status: response.status()
        })
      }
    })
    
    await page.goto('http://127.0.0.1:6173')
    
    // Navigate through workflow
    await page.click('text=Try Example Conversation')
    await page.waitForTimeout(1000)
    
    await page.click('text=Parse Transcript')
    await page.waitForTimeout(2000)
    
    // Log any issues found
    if (errors.length > 0) {
      console.log('🚨 Console errors detected:', errors)
    }
    
    if (networkFailures.length > 0) {
      console.log('🚨 Network failures detected:', networkFailures)
    }
    
    // The test passes if no critical errors
    expect(errors.filter(e => !e.includes('Warning'))).toHaveLength(0)
  })
})