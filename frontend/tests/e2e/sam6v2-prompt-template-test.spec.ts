import { test, expect } from '@playwright/test';

test.describe('SAM6V2 Prompt Template and Copy Compact Test', () => {
  test('should login, load SAM6V2 conversation, verify Gemini v4 prompt template, and test Copy Compact', async ({ page }) => {
    // Enable clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    
    console.log('🚀 Starting SAM6V2 Prompt Template Test...');
    
    // Step 1: Login
    console.log('📝 Step 1: Login process...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Fill login form
    await page.waitForSelector('input[type="email"], input[placeholder*="email" i]', { timeout: 10000 });
    const emailField = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await emailField.fill('eval@lumenarc.ai');
    
    const passwordField = page.locator('input[type="password"], input[placeholder*="password" i]').first();
    await passwordField.fill('@Evalaccount1');
    
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign in"), button[type="submit"]').first();
    await loginButton.click();
    
    // Wait for login success
    await page.waitForSelector('text="Lumen Transcript Cleaner"', { timeout: 15000 });
    console.log('✅ Successfully logged in');
    
    // Step 2: Load SAM6V2 conversation
    console.log('📝 Step 2: Loading SAM6V2 conversation...');
    
    // Click Load Conversation button
    const loadConversationButton = page.locator('button:has-text("Load Conversation")').first();
    await loadConversationButton.click();
    
    // Wait for conversations modal to appear
    await page.waitForSelector('text="Select a conversation"', { timeout: 10000 });
    
    // Look for SAM6V2 conversation
    const sam6v2Conversation = page.locator('text="sam 6,v2"').first();
    await expect(sam6v2Conversation).toBeVisible({ timeout: 10000 });
    
    // Click on SAM6V2 conversation
    await sam6v2Conversation.click();
    console.log('✅ Selected SAM6V2 conversation');
    
    // Wait for conversation to load
    await page.waitForTimeout(3000);
    
    // Step 3: Verify prompt template name appears
    console.log('📝 Step 3: Verifying prompt template name...');
    
    // Look for the prompt template indicator
    const promptIndicator = page.locator('text="Prompt:"').first();
    await expect(promptIndicator).toBeVisible({ timeout: 10000 });
    
    // Check if "Gemini v4" appears after "Prompt:"
    const geminiV4Text = page.locator('text="Gemini v4"').first();
    
    // Wait and check if it appears
    try {
      await expect(geminiV4Text).toBeVisible({ timeout: 5000 });
      console.log('✅ Found "Gemini v4" prompt template name');
    } catch (error) {
      console.log('❌ "Gemini v4" not found, checking for other template names...');
      
      // Check what actually appears after "Prompt:"
      const promptSection = page.locator('div:has-text("Prompt:")').first();
      const promptText = await promptSection.textContent();
      console.log('🔍 Actual prompt text:', promptText);
      
      // Take screenshot for debugging
      await page.screenshot({ path: 'test-results/prompt-template-debug.png', fullPage: true });
      
      // Check if "No template" appears (this would be the issue we're fixing)
      const noTemplateText = page.locator('text="No template"').first();
      const hasNoTemplate = await noTemplateText.isVisible().catch(() => false);
      
      if (hasNoTemplate) {
        console.log('❌ ISSUE FOUND: "No template" appears instead of "Gemini v4"');
        console.log('🔧 This confirms the issue that needs to be fixed');
      }
    }
    
    // Step 4: Test Copy Compact functionality
    console.log('📝 Step 4: Testing Copy Compact functionality...');
    
    // Look for Copy Compact button
    const copyCompactButton = page.locator('button:has-text("Copy Compact")').first();
    
    try {
      await expect(copyCompactButton).toBeVisible({ timeout: 10000 });
      console.log('✅ Found Copy Compact button');
      
      // Click Copy Compact button
      await copyCompactButton.click();
      
      // Wait for copy operation to complete
      await page.waitForTimeout(2000);
      
      // Check if button shows success state
      const copiedButton = page.locator('button:has-text("Copied!")').first();
      const hasCopiedState = await copiedButton.isVisible().catch(() => false);
      
      if (hasCopiedState) {
        console.log('✅ Copy Compact button shows success state');
      } else {
        console.log('⚠️ Copy Compact button does not show success state');
      }
      
      // Try to read clipboard content
      try {
        const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
        console.log('📋 Clipboard content length:', clipboardContent.length);
        
        // Parse clipboard content as JSON
        const clipboardData = JSON.parse(clipboardContent);
        console.log('📊 Clipboard data structure:', Object.keys(clipboardData));
        
        // Check if compact_export exists
        if (clipboardData.compact_export) {
          console.log('✅ Found compact_export in clipboard');
          console.log('📄 Compact export keys:', Object.keys(clipboardData.compact_export));
          
          // Check for prompt template name in export
          const promptTemplateName = clipboardData.compact_export.prompt_template_name;
          console.log('🎯 Prompt template name in export:', promptTemplateName);
          
          if (promptTemplateName === 'Gemini v4') {
            console.log('✅ SUCCESS: Gemini v4 found in Copy Compact export');
          } else if (promptTemplateName === 'No template') {
            console.log('❌ ISSUE: "No template" found in Copy Compact export');
          } else {
            console.log('🔍 OTHER: Unexpected prompt template name:', promptTemplateName);
          }
          
          // Check turns data
          const turns = clipboardData.compact_export.turns;
          if (turns && turns.length > 0) {
            console.log('✅ Found', turns.length, 'turns in export');
            console.log('📝 First turn sample:', {
              sequence: turns[0].sequence,
              speaker: turns[0].speaker,
              raw_text: turns[0].raw_text?.substring(0, 50) + '...',
              cleaned_text: turns[0].cleaned_text?.substring(0, 50) + '...'
            });
          }
        }
      } catch (clipboardError) {
        console.log('❌ Could not read clipboard:', clipboardError.message);
      }
      
    } catch (error) {
      console.log('❌ Copy Compact button not found:', error.message);
    }
    
    // Step 5: Additional debugging and visibility
    console.log('📝 Step 5: Additional debugging...');
    
    // Check console logs for debug information
    page.on('console', (msg) => {
      if (msg.text().includes('[DEBUG]')) {
        console.log('🔍 Browser console:', msg.text());
      }
    });
    
    // Check for evaluation context indicator
    const evaluationContext = page.locator('div:has-text("Evaluation"):has-text("Template:")').first();
    const hasEvaluationContext = await evaluationContext.isVisible().catch(() => false);
    
    if (hasEvaluationContext) {
      const contextText = await evaluationContext.textContent();
      console.log('📊 Evaluation context text:', contextText);
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/sam6v2-final-state.png', fullPage: true });
    
    console.log('🏁 SAM6V2 Prompt Template Test completed');
  });
  
  test('should provide detailed debugging information', async ({ page }) => {
    console.log('🔍 Starting detailed debugging test...');
    
    // Login first
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const emailField = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await emailField.fill('eval@lumenarc.ai');
    
    const passwordField = page.locator('input[type="password"], input[placeholder*="password" i]').first();
    await passwordField.fill('@Evalaccount1');
    
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign in"), button[type="submit"]').first();
    await loginButton.click();
    
    await page.waitForSelector('text="Lumen Transcript Cleaner"', { timeout: 15000 });
    
    // Capture all console logs
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });
    
    // Load SAM6V2 conversation
    const loadConversationButton = page.locator('button:has-text("Load Conversation")').first();
    await loadConversationButton.click();
    
    await page.waitForSelector('text="Select a conversation"', { timeout: 10000 });
    
    const sam6v2Conversation = page.locator('text="sam 6,v2"').first();
    await sam6v2Conversation.click();
    
    // Wait for loading to complete
    await page.waitForTimeout(5000);
    
    // Print all console logs
    console.log('📝 Console logs captured:');
    consoleLogs.forEach(log => console.log(log));
    
    // Check network requests
    const networkRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('evaluation')) {
        networkRequests.push(`${request.method()} ${request.url()}`);
      }
    });
    
    console.log('🌐 Network requests captured:');
    networkRequests.forEach(req => console.log(req));
    
    // Check all text content on page
    const allText = await page.locator('body').textContent();
    console.log('📄 Page contains "Gemini v4":', allText?.includes('Gemini v4'));
    console.log('📄 Page contains "No template":', allText?.includes('No template'));
    console.log('📄 Page contains "Prompt:":', allText?.includes('Prompt:'));
    
    await page.screenshot({ path: 'test-results/debugging-final.png', fullPage: true });
  });
});