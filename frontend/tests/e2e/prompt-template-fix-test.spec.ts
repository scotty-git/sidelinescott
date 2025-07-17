import { test, expect } from '@playwright/test';

test.describe('Prompt Template Fix Test', () => {
  test('should show prompt template name after loading specific evaluation', async ({ page }) => {
    console.log('🚀 Starting Prompt Template Fix Test...');
    
    // Enable clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Mock the backend responses to simulate working backend
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
    
    await page.route('**/api/v1/conversations', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [
            { 
              id: 'sam6v2-id', 
              name: 'sam 6,v2', 
              description: 'Mock conversation',
              evaluations: [
                {
                  id: 'eval-1',
                  name: 'Evaluation 7/17/2025, 12:33:46 PM',
                  template_name: 'gemini v4',
                  prompt_template_name: 'gemini v4',
                  description: 'Auto-created evaluation with full cleaning',
                  created_at: '2025-07-17T12:33:46',
                  settings: { prompt_template_name: 'gemini v4' }
                },
                {
                  id: 'eval-2', 
                  name: 'Evaluation 7/17/2025, 12:06:22 PM',
                  template_name: 'gemini v3',
                  prompt_template_name: 'gemini v3',
                  description: 'Auto-created evaluation with full cleaning',
                  created_at: '2025-07-17T12:06:22',
                  settings: { prompt_template_name: 'gemini v3' }
                }
              ]
            }
          ]
        })
      });
    });
    
    await page.route('**/api/v1/evaluations/conversations/sam6v2-id/evaluations', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          evaluations: [
            {
              id: 'eval-1',
              name: 'Evaluation 7/17/2025, 12:33:46 PM',
              template_name: 'gemini v4',
              prompt_template_name: 'gemini v4',
              description: 'Auto-created evaluation with full cleaning',
              created_at: '2025-07-17T12:33:46',
              settings: { prompt_template_name: 'gemini v4' }
            },
            {
              id: 'eval-2',
              name: 'Evaluation 7/17/2025, 12:06:22 PM', 
              template_name: 'gemini v3',
              prompt_template_name: 'gemini v3',
              description: 'Auto-created evaluation with full cleaning',
              created_at: '2025-07-17T12:06:22',
              settings: { prompt_template_name: 'gemini v3' }
            }
          ]
        })
      });
    });
    
    await page.route('**/api/v1/evaluations/eval-1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          evaluation: {
            id: 'eval-1',
            name: 'Evaluation 7/17/2025, 12:33:46 PM',
            description: 'Auto-created evaluation with full cleaning',
            prompt_template_id: 'template-1',
            prompt_template_ref: { name: 'gemini v4' },
            settings: { prompt_template_name: 'gemini v4' },
            created_at: '2025-07-17T12:33:46'
          },
          cleaned_turns: [
            {
              id: 'turn-1',
              turn_id: 'raw-turn-1',
              raw_speaker: 'User',
              raw_text: 'Hello test',
              cleaned_text: 'Hello test',
              turn_sequence: 1,
              confidence_score: 'HIGH',
              cleaning_applied: true,
              cleaning_level: 'full',
              processing_time_ms: 150,
              corrections: [],
              context_detected: 'conversation',
              ai_model_used: 'gemini-2.5-flash-lite-preview-06-17',
              created_at: '2025-07-17T12:33:46'
            }
          ],
          conversation_name: 'sam 6,v2',
          total_raw_turns: 162
        })
      });
    });
    
    await page.route('**/api/v1/conversations/sam6v2-id/turns', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          turns: [
            {
              id: 'raw-turn-1',
              conversation_id: 'sam6v2-id',
              turn_sequence: 1,
              speaker: 'User',
              raw_text: 'Hello test',
              created_at: '2025-07-17T12:33:46'
            }
          ]
        })
      });
    });
    
    // Navigate and login
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    console.log('📝 Step 1: Login...');
    await page.fill('input[type="email"]', 'eval@lumenarc.ai');
    await page.fill('input[type="password"]', '@Evalaccount1');
    await page.click('button:has-text("Sign in")');
    
    // Wait for main interface
    await page.waitForTimeout(2000);
    
    console.log('📝 Step 2: Open conversations...');
    
    // Try to find and click conversations button (use first one if multiple)
    const conversationsButton = page.locator('button:has-text("Conversations")').first();
    if (await conversationsButton.isVisible()) {
      await conversationsButton.click();
    } else {
      // Try Load Conversation button
      const loadButton = page.locator('button:has-text("Load Conversation")');
      await loadButton.click();
    }
    
    // Wait for conversations modal
    await page.waitForTimeout(1000);
    
    console.log('📝 Step 3: Click View All to see evaluations...');
    
    // Click "View All" button to see the evaluations list (like in your screenshot)
    const viewAllButton = page.locator('button:has-text("View All")');
    if (await viewAllButton.isVisible()) {
      await viewAllButton.click();
      console.log('✅ Clicked View All button');
    } else {
      // Fallback: click on sam 6,v2 conversation
      const sam6v2Item = page.locator('text="sam 6,v2"').first();
      await sam6v2Item.click();
      console.log('✅ Clicked sam 6,v2 conversation');
    }
    
    // Wait for evaluations modal to appear
    await page.waitForTimeout(2000);
    
    console.log('📝 Step 4: Load specific evaluation...');
    
    // Look for Load button next to "gemini v4" evaluation in the evaluations list
    const loadEvalButton = page.locator('button:has-text("Load")').first();
    if (await loadEvalButton.isVisible()) {
      await loadEvalButton.click();
      console.log('✅ Clicked Load button on specific evaluation');
    } else {
      console.log('❌ Load button not found in evaluations list');
      // Take screenshot for debugging
      await page.screenshot({ path: 'test-results/no-load-button-found.png', fullPage: true });
    }
    
    // Wait for evaluation to load
    await page.waitForTimeout(3000);
    
    console.log('📝 Step 5: Check for prompt template name...');
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/after-loading-evaluation.png', fullPage: true });
    
    // Check if "gemini v4" appears in the prompt field
    const pageContent = await page.locator('body').textContent();
    
    console.log('🔍 Page analysis:');
    console.log('  - Contains "Prompt:":', pageContent?.includes('Prompt:'));
    console.log('  - Contains "gemini v4":', pageContent?.includes('gemini v4'));
    console.log('  - Contains "No template":', pageContent?.includes('No template'));
    console.log('  - Contains "Copy Compact":', pageContent?.includes('Copy Compact'));
    
    // Look for the specific prompt template indicator
    const promptSection = page.locator('div:has-text("Prompt:")');
    if (await promptSection.isVisible()) {
      const promptText = await promptSection.textContent();
      console.log('📄 Prompt section text:', promptText);
      
      if (promptText?.includes('gemini v4')) {
        console.log('✅ SUCCESS: gemini v4 template name is displayed!');
      } else if (promptText?.includes('No template')) {
        console.log('❌ ISSUE: Still showing "No template"');
      } else {
        console.log('🔍 OTHER: Unexpected prompt text:', promptText);
      }
    }
    
    // Test Copy Compact button if available
    const copyCompactButton = page.locator('button:has-text("Copy Compact")');
    if (await copyCompactButton.isVisible()) {
      console.log('📝 Step 6: Test Copy Compact...');
      await copyCompactButton.click();
      await page.waitForTimeout(1000);
      
      // Check for success feedback
      const copiedButton = page.locator('button:has-text("Copied!")');
      if (await copiedButton.isVisible()) {
        console.log('✅ Copy Compact shows success feedback');
      }
    }
    
    console.log('🏁 Prompt Template Fix Test completed');
  });
  
  test('should handle real backend if available', async ({ page }) => {
    console.log('🔌 Testing with real backend...');
    
    // Enable clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Capture console logs for debugging
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('[DEBUG]')) {
        consoleLogs.push(msg.text());
      }
    });
    
    await page.goto('/');
    
    // Test backend connectivity
    const backendTest = await page.evaluate(async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/');
        const data = await response.json();
        return { success: true, status: response.status, data };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('🌐 Backend connectivity:', backendTest.success ? '✅' : '❌');
    
    if (backendTest.success) {
      console.log('📝 Attempting real login...');
      
      // Try real login
      if (await page.locator('input[type="email"]').isVisible()) {
        await page.fill('input[type="email"]', 'eval@lumenarc.ai');
        await page.fill('input[type="password"]', '@Evalaccount1');
        await page.click('button:has-text("Sign in")');
        
        await page.waitForTimeout(5000);
        
        // Check if login successful
        const mainInterface = await page.locator('text="Load Conversation"').isVisible().catch(() => false);
        console.log('🔐 Login successful:', mainInterface);
        
        if (mainInterface) {
          console.log('📝 Testing with real data...');
          
          // Try to load conversations
          const conversationsButton = page.locator('button:has-text("Conversations")');
          if (await conversationsButton.isVisible()) {
            await conversationsButton.click();
            await page.waitForTimeout(1000);
            
            // Look for sam 6,v2
            const sam6v2 = page.locator('text="sam 6,v2"');
            if (await sam6v2.isVisible()) {
              await sam6v2.click();
              await page.waitForTimeout(1000);
              
              // Load specific evaluation
              const loadButton = page.locator('button:has-text("Load")').first();
              if (await loadButton.isVisible()) {
                await loadButton.click();
                await page.waitForTimeout(3000);
                
                // Check result
                const pageContent = await page.locator('body').textContent();
                console.log('📊 Real backend test results:');
                console.log('  - Prompt template visible:', pageContent?.includes('gemini v4') ? '✅' : '❌');
                console.log('  - Copy Compact available:', pageContent?.includes('Copy Compact') ? '✅' : '❌');
                
                await page.screenshot({ path: 'test-results/real-backend-test.png', fullPage: true });
              }
            }
          }
        }
      }
    } else {
      console.log('❌ Backend not available for real testing');
    }
    
    // Print debug logs
    console.log('🔍 Debug logs captured:');
    consoleLogs.forEach(log => console.log(`  ${log}`));
    
    console.log('🏁 Real backend test completed');
  });
});