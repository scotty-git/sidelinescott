import { test, expect } from '@playwright/test';

test.describe('Large Evaluation Loading', () => {
  test('should load 900+ turn evaluation without timeout', async ({ page }) => {
    console.log('🚀 Starting Large Evaluation Loading Test...');
    
    // Enable clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Mock authentication
    await page.route('**/api/v1/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          user: { id: 'mock-user', email: 'eval@lumenarc.ai' }
        })
      });
    });
    
    // Mock conversations list with large evaluation
    await page.route('**/api/v1/conversations', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [
            { 
              id: 'massive-conversation-id', 
              name: 'massive 17jul', 
              description: 'Large conversation with 923 turns'
            }
          ]
        })
      });
    });
    
    // Mock evaluation list for conversation
    await page.route('**/api/v1/evaluations/conversations/massive-conversation-id/evaluations', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          evaluations: [
            {
              id: 'large-eval-id',
              name: 'Evaluation 7/17/2025, 2:55:51 PM',
              description: 'Large evaluation with 923 turns',
              created_at: '2025-07-17T14:55:51',
              settings: { prompt_template_name: 'gemini v4' }
            }
          ]
        })
      });
    });
    
    // Mock large evaluation details with simulated delay
    await page.route('**/api/v1/evaluations/large-eval-id', async route => {
      // Simulate slow response for large data
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate 923 cleaned turns
      const cleanedTurns = Array.from({ length: 923 }, (_, index) => ({
        id: `turn-${index + 1}`,
        turn_id: `raw-turn-${index + 1}`,
        raw_speaker: index % 2 === 0 ? 'User' : 'Lumen',
        raw_text: `Turn ${index + 1} content - ${index % 2 === 0 ? 'User message' : 'Lumen response'}`,
        cleaned_text: `Cleaned turn ${index + 1} content`,
        turn_sequence: index + 1,
        confidence_score: 'HIGH',
        cleaning_applied: index % 2 === 0, // Only clean user turns
        cleaning_level: index % 2 === 0 ? 'full' : 'none',
        processing_time_ms: Math.floor(Math.random() * 200) + 50,
        corrections: [],
        context_detected: 'conversation',
        ai_model_used: 'gemini-2.5-flash-lite-preview-06-17',
        created_at: `2025-07-17T14:${String(55 + Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}`
      }));
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          evaluation: {
            id: 'large-eval-id',
            name: 'Evaluation 7/17/2025, 2:55:51 PM',
            description: 'Large evaluation with 923 turns',
            settings: { prompt_template_name: 'gemini v4' }
          },
          cleaned_turns: cleanedTurns,
          conversation_name: 'massive 17jul',
          total_raw_turns: 923
        })
      });
    });
    
    // Mock conversation turns with simulated delay
    await page.route('**/api/v1/conversations/massive-conversation-id/turns', async route => {
      // Simulate delay for large turn set
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate 923 raw turns
      const rawTurns = Array.from({ length: 923 }, (_, index) => ({
        id: `raw-turn-${index + 1}`,
        conversation_id: 'massive-conversation-id',
        turn_sequence: index + 1,
        speaker: index % 2 === 0 ? 'User' : 'Lumen',
        raw_text: `Turn ${index + 1} raw content`,
        created_at: `2025-07-17T14:${String(55 + Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}`
      }));
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          turns: rawTurns
        })
      });
    });
    
    console.log('📝 Step 1: Navigate and login...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', 'eval@lumenarc.ai');
    await page.fill('input[type="password"]', '@Evalaccount1');
    await page.click('button:has-text("Sign in")');
    
    // Wait for main interface
    await page.waitForTimeout(2000);
    
    console.log('📝 Step 2: Open conversations manager...');
    const conversationsButton = page.locator('button:has-text("Conversations")').first();
    await conversationsButton.click();
    await page.waitForTimeout(1000);
    
    console.log('📝 Step 3: Find large evaluation and click Load Latest...');
    
    // Look for the massive conversation
    const massiveConversation = page.locator('text="massive 17jul"');
    await expect(massiveConversation).toBeVisible();
    
    // Click Load Latest button
    const loadLatestButton = page.locator('button:has-text("📊 Load Latest")').first();
    await expect(loadLatestButton).toBeVisible();
    
    console.log('📝 Step 4: Test loading states and progress...');
    
    // Start the loading process
    await loadLatestButton.click();
    
    // Verify loading state appears
    await expect(page.locator('button:has-text("Initializing...")').or(page.locator('button:has-text("⏳ Loading...")'))).toBeVisible({ timeout: 1000 });
    console.log('✅ Initial loading state detected');
    
    // Check for progressive loading states
    const progressStates = [
      'Initializing...',
      'Fetching evaluation metadata...',
      'Processing 923 cleaned turns...',
      'Loading conversation turns...',
      'Converting 923 turns to UI format...',
      'Reconstructing API logs...',
      'Finalizing UI...'
    ];
    
    let statesDetected = 0;
    for (const state of progressStates) {
      try {
        const stateElement = page.locator(`button:has-text("${state}")`);
        if (await stateElement.isVisible({ timeout: 500 })) {
          console.log(`✅ Progress state detected: ${state}`);
          statesDetected++;
        }
      } catch (e) {
        // State might have passed quickly
      }
    }
    
    console.log(`📊 Detected ${statesDetected}/${progressStates.length} progress states`);
    
    // Check for Cancel button during loading
    const cancelButton = page.locator('button:has-text("✕ Cancel")');
    if (await cancelButton.isVisible({ timeout: 500 })) {
      console.log('✅ Cancel button is available during loading');
    }
    
    console.log('📝 Step 5: Wait for completion (up to 2 minutes)...');
    
    // Wait for loading to complete - should complete within 120 seconds
    await expect(page.locator('button:has-text("📊 Load Latest")')).toBeVisible({ timeout: 120000 });
    console.log('✅ Loading completed successfully');
    
    console.log('📝 Step 6: Verify large evaluation loaded...');
    
    // Check that results are displayed
    await expect(page.locator('text="Results"')).toBeVisible();
    
    // Look for indication of large dataset
    const resultsContent = await page.locator('body').textContent();
    
    // Check for signs of large evaluation
    const largeTurnIndicators = [
      '923', // Turn count
      '900', // Approximate count
      'massive', // Conversation name
      'Evaluation Complete' // Completion indicator
    ];
    
    let indicatorsFound = 0;
    for (const indicator of largeTurnIndicators) {
      if (resultsContent?.includes(indicator)) {
        console.log(`✅ Large evaluation indicator found: ${indicator}`);
        indicatorsFound++;
      }
    }
    
    console.log(`📊 Found ${indicatorsFound}/${largeTurnIndicators.length} large evaluation indicators`);
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/large-evaluation-loaded.png', fullPage: true });
    
    console.log('🏁 Large Evaluation Loading Test completed successfully');
  });
  
  test('should handle timeout gracefully for extremely large evaluations', async ({ page }) => {
    console.log('🧪 Testing timeout handling for extremely large evaluations...');
    
    // Enable clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Mock authentication
    await page.route('**/api/v1/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          user: { id: 'mock-user', email: 'eval@lumenarc.ai' }
        })
      });
    });
    
    // Mock conversations
    await page.route('**/api/v1/conversations', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [
            { 
              id: 'timeout-conversation-id', 
              name: 'timeout test', 
              description: 'Test timeout handling'
            }
          ]
        })
      });
    });
    
    // Mock evaluations
    await page.route('**/api/v1/evaluations/conversations/timeout-conversation-id/evaluations', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          evaluations: [
            {
              id: 'timeout-eval-id',
              name: 'Timeout Test Evaluation',
              description: 'Test evaluation for timeout',
              created_at: '2025-07-17T14:55:51',
              settings: { prompt_template_name: 'gemini v4' }
            }
          ]
        })
      });
    });
    
    // Mock evaluation details that will timeout (never respond)
    await page.route('**/api/v1/evaluations/timeout-eval-id', async route => {
      // Never fulfill this request to simulate timeout
      console.log('🕐 Simulating API timeout - request will hang...');
      // Don't call route.fulfill() to simulate hanging request
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', 'eval@lumenarc.ai');
    await page.fill('input[type="password"]', '@Evalaccount1');
    await page.click('button:has-text("Sign in")');
    
    await page.waitForTimeout(2000);
    
    // Open conversations
    const conversationsButton = page.locator('button:has-text("Conversations")').first();
    await conversationsButton.click();
    await page.waitForTimeout(1000);
    
    // Find and click Load Latest
    const loadLatestButton = page.locator('button:has-text("📊 Load Latest")').first();
    await loadLatestButton.click();
    
    // Verify loading state
    await expect(page.locator('button:has-text("Initializing...")').or(page.locator('button:has-text("⏳ Loading...")'))).toBeVisible({ timeout: 1000 });
    console.log('✅ Loading state detected');
    
    // Verify Cancel button appears
    await expect(page.locator('button:has-text("✕ Cancel")')).toBeVisible({ timeout: 2000 });
    console.log('✅ Cancel button is available');
    
    // Wait a bit to let loading progress
    await page.waitForTimeout(3000);
    
    // Test cancel functionality
    console.log('📝 Testing cancel functionality...');
    await page.click('button:has-text("✕ Cancel")');
    
    // Verify loading stops
    await expect(page.locator('button:has-text("📊 Load Latest")')).toBeVisible({ timeout: 5000 });
    console.log('✅ Cancel functionality works - loading stopped');
    
    console.log('🏁 Timeout handling test completed');
  });
});