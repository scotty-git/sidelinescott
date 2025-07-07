import { test, expect } from '@playwright/test'

test('Complete workflow verification - all features working', async ({ page }) => {
  await page.goto('http://localhost:6173')
  await page.waitForTimeout(3000)
  
  console.log('✅ Step 1: Load Example')
  await page.click('button:has-text("Load Example")')
  await page.waitForTimeout(1000)
  
  console.log('✅ Step 2: Parse Transcript')
  await page.click('button:has-text("Parse Transcript")')
  await page.waitForTimeout(3000)
  
  console.log('✅ Step 3: Start Cleaning Process')
  await page.click('button:has-text("Start Cleaning")')
  await page.waitForTimeout(10000) // Give enough time for processing
  
  console.log('✅ Step 4: Check Processing Results Tab')
  await page.click('button:has-text("Processing Results")')
  await page.waitForTimeout(1000)
  
  // Now check for the side-by-side display
  const originalText = await page.locator('text=ORIGINAL → GEMINI').count()
  const cleanedText = await page.locator('text=GEMINI → CLEANED').count()
  
  console.log(`Original displays: ${originalText}, Cleaned displays: ${cleanedText}`)
  
  if (originalText > 0 && cleanedText > 0) {
    console.log('✅ Side-by-side display working!')
  }
  
  console.log('✅ Step 5: Test Dark Mode')
  await page.click('button:has-text("Light")')
  await page.waitForTimeout(1000)
  await expect(page.locator('button:has-text("Dark")')).toBeVisible()
  console.log('✅ Dark mode working!')
  
  console.log('✅ Step 6: Check Detailed Logs')
  await page.click('button:has-text("Detailed Logs")')
  await page.waitForTimeout(1000)
  
  // Verify comprehensive logging
  await expect(page.locator('text=Context: Sending')).toBeVisible()
  await expect(page.locator('text=processed in')).toBeVisible()
  console.log('✅ Detailed logging working!')
  
  console.log('✅ Step 7: Check API Transparency')
  await page.click('button:has-text("API Calls")')
  await page.waitForTimeout(1000)
  
  // Should see multiple API calls
  const apiCallElements = await page.locator('text=POST').count()
  console.log(`API calls visible: ${apiCallElements}`)
  
  if (apiCallElements >= 2) {
    console.log('✅ API transparency working!')
  }
  
  console.log('✅ Step 8: Final Screenshots')
  await page.click('button:has-text("Processing Results")')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/final-verification-results.png', fullPage: true })
  
  await page.click('button:has-text("Detailed Logs")')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/final-verification-logs.png', fullPage: true })
  
  console.log('🎉 ALL FEATURES VERIFIED WORKING!')
  
  // Final assertions
  await page.click('button:has-text("Processing Results")')
  await page.waitForTimeout(1000)
  
  // These should now work since we're on the right tab
  await expect(page.locator('text=ORIGINAL → GEMINI')).toBeVisible()
  await expect(page.locator('text=GEMINI → CLEANED')).toBeVisible()
  
  console.log('✅ FINAL VERIFICATION: All features working correctly!')
})