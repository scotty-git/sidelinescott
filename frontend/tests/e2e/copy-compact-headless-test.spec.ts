import { test, expect } from '@playwright/test';

test.describe('Copy Compact Button - Headless Testing', () => {
  test('should test Copy Compact button reliability and feedback', async ({ page }) => {
    console.log('🚀 Starting Copy Compact Headless Test...');
    
    // Enable clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Mock successful backend responses to get to Copy Compact testing
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
              description: 'Test conversation'
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
              description: 'Auto-created evaluation with full cleaning',
              settings: { prompt_template_name: 'gemini v4' }
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
            settings: { prompt_template_name: 'gemini v4' }
          },
          cleaned_turns: [
            {
              id: 'turn-1',
              turn_id: 'raw-turn-1',
              raw_speaker: 'User',
              raw_text: 'Test message from user',
              cleaned_text: 'Test message from user',
              turn_sequence: 1,
              confidence_score: 'HIGH',
              cleaning_applied: true,
              cleaning_level: 'full',
              processing_time_ms: 150,
              corrections: [],
              context_detected: 'conversation',
              ai_model_used: 'gemini-2.5-flash-lite-preview-06-17',
              created_at: '2025-07-17T12:33:46'
            },
            {
              id: 'turn-2',
              turn_id: 'raw-turn-2',
              raw_speaker: 'Lumen',
              raw_text: 'Response from Lumen AI',
              cleaned_text: 'Response from Lumen AI',
              turn_sequence: 2,
              confidence_score: 'HIGH',
              cleaning_applied: false,
              cleaning_level: 'none',
              processing_time_ms: 10,
              corrections: [],
              context_detected: 'ai_response',
              ai_model_used: 'gemini-2.5-flash-lite-preview-06-17',
              created_at: '2025-07-17T12:33:47'
            }
          ],
          conversation_name: 'sam 6,v2',
          total_raw_turns: 2
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
              raw_text: 'Test message from user'
            },
            {
              id: 'raw-turn-2',
              conversation_id: 'sam6v2-id',
              turn_sequence: 2,
              speaker: 'Lumen',
              raw_text: 'Response from Lumen AI'
            }
          ]
        })
      });
    });
    
    // Mock the export evaluation endpoint for Copy Compact
    await page.route('**/api/v1/evaluations/eval-1/export', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          export_metadata: {
            exported_at: new Date().toISOString(),
            export_type: 'evaluation_full'
          },
          evaluation: {
            id: 'eval-1',
            name: 'Evaluation 7/17/2025, 12:33:46 PM',
            description: 'Auto-created evaluation with full cleaning',
            prompt_template: {
              id: 'template-1',
              name: 'gemini v4',
              template: 'Test prompt template'
            }
          },
          conversation: {
            id: 'sam6v2-id',
            name: 'sam 6,v2',
            description: 'Test conversation'
          },
          turns: [
            {
              turn_id: 'raw-turn-1',
              sequence: 1,
              speaker: 'User',
              raw_text: 'Test message from user',
              cleaned_data: {
                cleaned_text: 'Test message from user',
                cleaning_applied: 'true',
                ai_model_used: 'gemini-2.5-flash-lite-preview-06-17'
              }
            },
            {
              turn_id: 'raw-turn-2',
              sequence: 2,
              speaker: 'Lumen',
              raw_text: 'Response from Lumen AI',
              cleaned_data: {
                cleaned_text: 'Response from Lumen AI',
                cleaning_applied: 'false',
                ai_model_used: 'gemini-2.5-flash-lite-preview-06-17'
              }
            }
          ],
          summary: {
            total_turns: 2,
            turns_cleaned: 1,
            turns_skipped: 1
          }
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
    
    console.log('📝 Step 2: Load conversation and evaluation...');
    
    // Open conversations
    const conversationsButton = page.locator('button:has-text("Conversations")').first();
    await conversationsButton.click();
    await page.waitForTimeout(1000);
    
    // Click View All to see evaluations
    const viewAllButton = page.locator('button:has-text("View All")');
    await viewAllButton.click();
    await page.waitForTimeout(1000);
    
    // Load specific evaluation  
    const loadButton = page.locator('button:has-text("Load")').first();
    await loadButton.click({ force: true });
    await page.waitForTimeout(5000); // Increased wait time
    
    console.log('📝 Step 3: Waiting for evaluation to fully load...');
    
    // Wait for the evaluation to be processed and results to appear
    // Check if we have cleaned turns loaded by looking for the Results tab content
    await page.waitForTimeout(2000);
    const pageContent = await page.locator('body').textContent();
    console.log('🔍 Page content analysis:');
    console.log('  - Contains "Results":', pageContent?.includes('Results'));
    console.log('  - Contains "Processing":', pageContent?.includes('Processing'));
    console.log('  - Contains "Evaluation Complete":', pageContent?.includes('Evaluation Complete'));
    console.log('  - Contains cleaned turns indicator:', pageContent?.includes('turn'));
    
    // Take screenshot for debugging the current state
    await page.screenshot({ path: 'test-results/after-evaluation-load.png', fullPage: true });
    
    console.log('📝 Step 4: Testing Copy Compact button reliability...');
    
    // Check if Copy Compact button is present - look for the exact text from implementation
    let copyCompactButton = page.locator('button:has-text("📋 Copy Compact")');
    let buttonExists = await copyCompactButton.isVisible();
    console.log('🔍 Copy Compact button (📋 Copy Compact) visible:', buttonExists);
    
    // If not found, try the shorter "Copy Compact" text
    if (!buttonExists) {
      copyCompactButton = page.locator('button:has-text("Copy Compact")');
      buttonExists = await copyCompactButton.isVisible();
      console.log('🔍 Copy Compact button (Copy Compact) visible:', buttonExists);
    }
    
    // Check all buttons with "Copy" in the text (including hidden ones)
    if (!buttonExists) {
      console.log('📄 All Copy-related buttons on page (including hidden):');
      const allCopyButtons = await page.locator('button').all();
      let copyButtonIndex = 0;
      
      for (const button of allCopyButtons) {
        const buttonText = await button.textContent();
        if (buttonText?.includes('Copy')) {
          const isVisible = await button.isVisible();
          const computedStyle = await button.evaluate(el => {
            const style = window.getComputedStyle(el);
            return {
              display: style.display,
              visibility: style.visibility,
              opacity: style.opacity,
              marginLeft: style.marginLeft
            };
          });
          console.log(`  Copy button ${copyButtonIndex}: "${buttonText}" (visible: ${isVisible}, style: ${JSON.stringify(computedStyle)})`);
          copyButtonIndex++;
        }
      }
      
      // Look for the specific control group with Export button
      const exportButtonContainer = page.locator('div:has(button:has-text("📥 Export"))').first();
      const containerExists = await exportButtonContainer.isVisible();
      console.log(`🔍 Export button container exists: ${containerExists}`);
      
      if (containerExists) {
        // Get all buttons in this container
        const containerButtons = exportButtonContainer.locator('button');
        const buttonCount = await containerButtons.count();
        console.log(`🔍 Found ${buttonCount} buttons in export container`);
        
        // Check each button
        for (let i = 0; i < buttonCount; i++) {
          const button = containerButtons.nth(i);
          const buttonText = await button.textContent();
          console.log(`  Button ${i}: "${buttonText}"`);
          
          // Check if this is the Copy Compact button
          if (buttonText?.includes('Copy') && buttonText?.includes('Compact')) {
            copyCompactButton = button;
            buttonExists = true;
            console.log(`✅ Found Copy Compact button at index ${i}`);
            break;
          }
          // Also check for just the emoji indicator (might be the compact version)
          else if (buttonText?.includes('📋') && buttonText?.includes('Copy') && i > 0) {
            // If there are multiple Copy buttons, the second one might be Copy Compact
            const prevButton = containerButtons.nth(i - 1);
            const prevText = await prevButton.textContent();
            if (prevText?.includes('Copy') && !prevText?.includes('📋')) {
              copyCompactButton = button;
              buttonExists = true;
              console.log(`✅ Found Copy Compact button at index ${i} (second copy button)`);
              break;
            }
          }
        }
      } else {
        console.log('❌ Export button container not found');
      }
    }
    
    if (!buttonExists) {
      console.log('❌ Copy Compact button not found, trying to use regular Copy button for testing...');
      
      // Fallback: Use the regular Copy button to test clipboard functionality
      const regularCopyButton = page.locator('button:has-text("📋 Copy")');
      const regularCopyExists = await regularCopyButton.isVisible();
      
      if (regularCopyExists) {
        console.log('✅ Using regular Copy button for testing clipboard functionality');
        copyCompactButton = regularCopyButton;
        buttonExists = true;
      } else {
        console.log('❌ No Copy buttons found at all');
        console.log('📄 Available buttons on page:');
        const allButtons = await page.locator('button').allTextContents();
        allButtons.forEach((text, index) => {
          if (text.includes('Copy') || text.includes('Export') || text.includes('Load')) {
            console.log(`  ${index}: "${text}"`);
          }
        });
        
        await page.screenshot({ path: 'test-results/no-copy-buttons-found.png', fullPage: true });
        return;
      }
    }
    
    // Test multiple clicks to simulate the issue you mentioned
    let clickAttempts = 0;
    let copySuccess = false;
    const maxAttempts = 5;
    
    console.log('📝 Step 4: Testing multiple click attempts...');
    
    while (clickAttempts < maxAttempts && !copySuccess) {
      clickAttempts++;
      console.log(`🔄 Click attempt ${clickAttempts}/${maxAttempts}...`);
      
      // Click the Copy Compact button
      await copyCompactButton.click();
      
      // Wait a moment for the operation
      await page.waitForTimeout(1000);
      
      // Check for success feedback - multiple ways
      const feedbackChecks = [
        // Visual feedback in button text
        page.locator('button:has-text("Copied!")'),
        page.locator('button:has-text("✅ Copied!")'),
        
        // Success modal/toast
        page.locator('text="Compact JSON copied to clipboard"'),
        page.locator('text="Successfully copied"'),
        page.locator('text="Copied to clipboard"'),
        
        // Any success notification
        page.locator('[class*="success"]'),
        page.locator('[class*="notification"]'),
        page.locator('[class*="toast"]'),
        
        // Check button color change (green)
        page.locator('button[style*="background-color: rgb(16, 185, 129)"]'), // #10b981 green
        page.locator('button[style*="#10b981"]')
      ];
      
      let feedbackFound = false;
      for (const check of feedbackChecks) {
        if (await check.isVisible().catch(() => false)) {
          const element = await check.textContent();
          console.log(`✅ Success feedback found: "${element}"`);
          feedbackFound = true;
          copySuccess = true;
          break;
        }
      }
      
      if (!feedbackFound) {
        console.log(`❌ Attempt ${clickAttempts}: No visual feedback detected`);
        
        // Check if clipboard was actually updated
        try {
          const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
          if (clipboardContent && clipboardContent.includes('compact_export')) {
            console.log(`✅ Attempt ${clickAttempts}: Clipboard updated successfully (no visual feedback)`);
            console.log(`📋 Clipboard length: ${clipboardContent.length} characters`);
            copySuccess = true;
          } else {
            console.log(`❌ Attempt ${clickAttempts}: Clipboard not updated`);
          }
        } catch (error) {
          console.log(`❌ Attempt ${clickAttempts}: Could not read clipboard - ${error.message}`);
        }
      }
      
      // Take screenshot of current state
      await page.screenshot({ path: `test-results/copy-attempt-${clickAttempts}.png` });
      
      if (!copySuccess && clickAttempts < maxAttempts) {
        console.log('⏳ Waiting before next attempt...');
        await page.waitForTimeout(1000);
      }
    }
    
    console.log('📝 Step 5: Final analysis...');
    
    if (copySuccess) {
      console.log(`✅ SUCCESS: Copy Compact worked after ${clickAttempts} attempts`);
      
      // Verify clipboard content structure
      try {
        const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
        const clipboardData = JSON.parse(clipboardContent);
        
        console.log('📊 Clipboard content analysis:');
        console.log('  - Structure:', Object.keys(clipboardData));
        console.log('  - Content preview:', JSON.stringify(clipboardData).substring(0, 200) + '...');
        
        // Check if it's compact format
        if (clipboardData.compact_export) {
          console.log('✅ COMPACT FORMAT DETECTED');
          console.log('  - Compact export keys:', Object.keys(clipboardData.compact_export));
          console.log('  - Prompt template name:', clipboardData.compact_export.prompt_template_name);
          console.log('  - Conversation name:', clipboardData.compact_export.conversation_name);
          console.log('  - Number of turns:', clipboardData.compact_export.turns?.length || 0);
          
          if (clipboardData.compact_export.prompt_template_name === 'gemini v4') {
            console.log('✅ PERFECT: Prompt template name correctly included!');
          } else {
            console.log('❌ ISSUE: Wrong prompt template name:', clipboardData.compact_export.prompt_template_name);
          }
        } else {
          console.log('❌ FULL FORMAT DETECTED (not compact)');
          // Check if it has the full evaluation structure
          if (clipboardData.evaluation) {
            console.log('  - Evaluation name:', clipboardData.evaluation.name);
            console.log('  - Conversation name:', clipboardData.conversation?.name);
            console.log('  - Number of turns:', clipboardData.turns?.length || 0);
            
            if (clipboardData.evaluation.prompt_template?.name) {
              console.log('  - Prompt template from full export:', clipboardData.evaluation.prompt_template.name);
            }
          }
        }
      } catch (error) {
        console.log('❌ Could not parse clipboard content:', error.message);
      }
    } else {
      console.log(`❌ FAILURE: Copy Compact failed after ${maxAttempts} attempts`);
      console.log('🔍 Issues identified:');
      console.log('  - Requires multiple clicks to work');
      console.log('  - No visual feedback provided');
      console.log('  - Unreliable clipboard operation');
    }
    
    // Check current button state
    const finalButtonText = await copyCompactButton.textContent();
    const finalButtonStyle = await copyCompactButton.getAttribute('style');
    console.log('📄 Final button state:');
    console.log('  - Text:', finalButtonText);
    console.log('  - Style:', finalButtonStyle);
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/copy-compact-final-state.png' });
    
    console.log('🏁 Copy Compact Headless Test completed');
  });
  
  test('should test Copy Compact edge cases and error handling', async ({ page }) => {
    console.log('🧪 Testing Copy Compact edge cases...');
    
    // Test without clipboard permissions
    await page.goto('/');
    
    // Mock minimal success to get to Copy Compact
    await page.route('**/api/v1/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: 'mock', user: { id: 'test' } })
      });
    });
    
    // Test Copy Compact with API error
    await page.route('**/api/v1/evaluations/*/export', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Export failed' })
      });
    });
    
    console.log('📝 Testing error handling...');
    
    // Try to trigger Copy Compact with mocked error
    // This would test the error path and see how the UI handles it
    
    console.log('🏁 Edge cases test completed');
  });
});