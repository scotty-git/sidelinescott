import { test, expect } from '@playwright/test'

test.describe('Evaluation Workflow', () => {
  test('should create evaluation and process turns automatically', async ({ page }) => {
    // Auto-capture console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    
    // Auto-capture network failures
    const failedRequests: Array<{url: string, status: number}> = []
    page.on('response', response => {
      if (!response.ok()) failedRequests.push({
        url: response.url(), 
        status: response.status()
      })
    })

    // Navigate to the application
    await page.goto('http://127.0.0.1:6174')
    
    // Wait for app to load
    await expect(page.locator('h1')).toContainText('Lumen Transcript Cleaner')
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'evaluation-test-01-initial.png' })
    
    // Open conversations modal
    await page.click('button:has-text("💬 Load Conversation")')
    
    // Wait for modal to open
    await expect(page.locator('text=Create New Conversation')).toBeVisible()
    
    // Create a new conversation
    await page.fill('input[placeholder="Enter conversation name..."]', 'Test Evaluation Workflow')
    await page.fill('textarea[placeholder="Optional description..."]', 'Testing the new evaluation system')
    await page.fill('textarea[placeholder="Paste your raw transcript here..."]', `
Speaker 1: Hello, um, how are you doing today?
Speaker 2: I'm doing great, thanks for asking!
Speaker 1: That's, uh, that's really good to hear.
    `)
    
    // Click create conversation
    await page.click('button:has-text("Create Conversation")')
    
    // Wait for conversation to be created and turns to be parsed
    await expect(page.locator('text=turns loaded')).toBeVisible({ timeout: 10000 })
    
    // Take screenshot after conversation creation
    await page.screenshot({ path: 'evaluation-test-02-conversation-created.png' })
    
    // Click Start Cleaning to trigger evaluation workflow
    await page.click('button:has-text("Start Cleaning")')
    
    // Wait for processing to complete
    await expect(page.locator('text=Evaluation Complete!')).toBeVisible({ timeout: 30000 })
    
    // Take screenshot of completed evaluation
    await page.screenshot({ path: 'evaluation-test-03-evaluation-complete.png' })
    
    // Verify cleaned results are displayed
    const resultsTab = page.locator('button:has-text("Results")')
    await expect(resultsTab).toBeVisible()
    
    // Check that cleaned turns are displayed
    await expect(page.locator('.cleaned-turn, [class*="turn"]')).toHaveCount(3, { timeout: 5000 })
    
    // Verify no save buttons (they should be removed)
    await expect(page.locator('button:has-text("💾 Save")')).not.toBeVisible()
    await expect(page.locator('button:has-text("📋 Save As")')).not.toBeVisible()
    
    // Check for evaluation complete message
    await expect(page.locator('text=automatically saved to the evaluation')).toBeVisible()
    
    // Auto-report any issues
    if (errors.length > 0 || failedRequests.length > 0) {
      console.log('🚨 Auto-detected issues:', { errors, failedRequests })
      throw new Error(`Test detected ${errors.length} console errors and ${failedRequests.length} failed requests`)
    }
    
    console.log('✅ Evaluation workflow test passed successfully!')
  })
})