import { test, expect } from '@playwright/test';

test.describe('Robust SAM6V2 Test', () => {
  test('should test SAM6V2 conversation loading and prompt template verification', async ({ page }) => {
    // Enable clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    
    console.log('🚀 Starting Robust SAM6V2 Test...');
    
    // Step 1: Navigate and wait for page
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Step 2: Check if we're on login page or main page
    const isLoginPage = await page.locator('input[type="email"]').isVisible();
    
    if (isLoginPage) {
      console.log('📝 Login page detected, logging in...');
      
      // Fill login form
      await page.fill('input[type="email"]', 'eval@lumenarc.ai');
      await page.fill('input[type="password"]', '@Evalaccount1');
      
      // Click login button
      await page.click('button:has-text("Sign in")');
      
      // Wait for login to complete or error
      try {
        await page.waitForSelector('text="Lumen Transcript Cleaner"', { timeout: 10000 });
        console.log('✅ Login successful');
      } catch (error) {
        console.log('❌ Login failed, checking for error message...');
        
        // Check if there's an error message
        const errorMessage = await page.locator('text="Failed to fetch"').isVisible().catch(() => false);
        if (errorMessage) {
          console.log('🔍 Backend connection issue detected');
          // Take screenshot and continue with limited testing
          await page.screenshot({ path: 'test-results/backend-connection-issue.png' });
        }
        
        // Check if still on login page
        const stillOnLogin = await page.locator('input[type="email"]').isVisible();
        if (stillOnLogin) {
          console.log('🔍 Still on login page, authentication may have failed');
        }
        
        throw error;
      }
    } else {
      console.log('✅ Already logged in or on main page');
    }
    
    // Step 3: Wait for main interface to load
    await page.waitForTimeout(3000);
    
    // Step 4: Look for Load Conversation button or Conversations panel
    const loadConversationButton = page.locator('button:has-text("Load Conversation")');
    const conversationsButton = page.locator('button:has-text("Conversations")');
    
    let conversationLoaded = false;
    
    // Try different approaches to load conversation
    if (await loadConversationButton.isVisible()) {
      console.log('📝 Found Load Conversation button, clicking...');
      await loadConversationButton.click();
      conversationLoaded = true;
    } else if (await conversationsButton.isVisible()) {
      console.log('📝 Found Conversations button, clicking...');
      await conversationsButton.click();
      conversationLoaded = true;
    } else {
      console.log('🔍 Looking for other conversation loading options...');
      
      // Check if there's already a conversation loaded
      const sam6v2Text = await page.locator('text="sam 6,v2"').isVisible().catch(() => false);
      if (sam6v2Text) {
        console.log('✅ SAM6V2 conversation already loaded');
        conversationLoaded = true;
      } else {
        // Look for any button that might load conversations
        const allButtons = await page.locator('button').all();
        console.log('🔍 Found buttons on page:');
        for (const button of allButtons) {
          const text = await button.textContent();
          console.log(`  - Button: "${text}"`);
        }
      }
    }
    
    if (conversationLoaded) {
      // Step 5: Wait for conversation modal or list
      try {
        await page.waitForSelector('text="Select a conversation"', { timeout: 5000 });
        console.log('✅ Conversation selection modal appeared');
      } catch (error) {
        console.log('🔍 No conversation selection modal, checking for other indicators...');
      }
      
      // Step 6: Look for SAM6V2 conversation
      const sam6v2Options = [
        'text="sam 6,v2"',
        'text="sam6v2"',
        'text="SAM6V2"',
        'text="sam 6,v2"',
        '[data-testid="conversation-sam6v2"]',
        'div:has-text("sam 6,v2")',
        'li:has-text("sam 6,v2")'
      ];
      
      let sam6v2Found = false;
      for (const selector of sam6v2Options) {
        const element = page.locator(selector);
        if (await element.isVisible().catch(() => false)) {
          console.log(`✅ Found SAM6V2 conversation with selector: ${selector}`);
          await element.click();
          sam6v2Found = true;
          break;
        }
      }
      
      if (!sam6v2Found) {
        console.log('🔍 SAM6V2 conversation not found, checking available conversations...');
        
        // List all available conversations
        const conversationItems = await page.locator('text*="v2", text*="sam", text*="conversation"').all();
        console.log('Available conversations:');
        for (const item of conversationItems) {
          const text = await item.textContent();
          console.log(`  - ${text}`);
        }
        
        // Take screenshot for debugging
        await page.screenshot({ path: 'test-results/conversations-list.png', fullPage: true });
      }
    }
    
    // Step 7: Wait for conversation to load
    await page.waitForTimeout(3000);
    
    // Step 8: Look for prompt template information
    console.log('📝 Checking for prompt template information...');
    
    const promptSelectors = [
      'text="Prompt:"',
      'text="Template:"',
      'text="Gemini v4"',
      'text="No template"',
      'div:has-text("Prompt")',
      'div:has-text("Template")'
    ];
    
    const promptInfo = [];
    for (const selector of promptSelectors) {
      const element = page.locator(selector);
      if (await element.isVisible().catch(() => false)) {
        const text = await element.textContent();
        promptInfo.push({ selector, text });
      }
    }
    
    console.log('🔍 Found prompt template information:');
    promptInfo.forEach(info => {
      console.log(`  - ${info.selector}: "${info.text}"`);
    });
    
    // Step 9: Check for Copy Compact button
    console.log('📝 Checking for Copy Compact button...');
    
    const copyCompactSelectors = [
      'button:has-text("Copy Compact")',
      'button:has-text("📋 Copy Compact")',
      'button:has-text("Copy")',
      '[data-testid="copy-compact-button"]'
    ];
    
    let copyCompactFound = false;
    for (const selector of copyCompactSelectors) {
      const element = page.locator(selector);
      if (await element.isVisible().catch(() => false)) {
        console.log(`✅ Found Copy Compact button with selector: ${selector}`);
        
        // Test clicking the button
        await element.click();
        
        // Wait for copy operation
        await page.waitForTimeout(2000);
        
        // Check for success feedback
        const copiedButton = page.locator('button:has-text("Copied!")');
        if (await copiedButton.isVisible().catch(() => false)) {
          console.log('✅ Copy Compact shows success feedback');
        }
        
        copyCompactFound = true;
        break;
      }
    }
    
    if (!copyCompactFound) {
      console.log('❌ Copy Compact button not found');
      
      // List all buttons for debugging
      const allButtons = await page.locator('button').all();
      console.log('🔍 All buttons on page:');
      for (const button of allButtons) {
        const text = await button.textContent();
        console.log(`  - "${text}"`);
      }
    }
    
    // Step 10: Take comprehensive screenshots
    await page.screenshot({ path: 'test-results/robust-test-final.png', fullPage: true });
    
    // Step 11: Check page content for debugging
    const pageContent = await page.locator('body').textContent();
    console.log('🔍 Page analysis:');
    console.log('  - Contains "Gemini v4":', pageContent?.includes('Gemini v4'));
    console.log('  - Contains "No template":', pageContent?.includes('No template'));
    console.log('  - Contains "Prompt:":', pageContent?.includes('Prompt:'));
    console.log('  - Contains "Copy Compact":', pageContent?.includes('Copy Compact'));
    console.log('  - Contains "sam 6,v2":', pageContent?.includes('sam 6,v2'));
    
    console.log('🏁 Robust SAM6V2 Test completed');
  });
  
  test('should run quick UI verification', async ({ page }) => {
    console.log('🔍 Starting quick UI verification...');
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/initial-state.png', fullPage: true });
    
    // Check if backend is responding
    const response = await page.evaluate(() => {
      return fetch('http://127.0.0.1:8000/')
        .then(response => response.json())
        .then(data => ({ success: true, data }))
        .catch(error => ({ success: false, error: error.message }));
    });
    
    console.log('🌐 Backend connectivity test:', response);
    
    // Get all visible text on page
    const visibleElements = await page.locator('*:visible').allTextContents();
    console.log('📄 Visible text elements:');
    visibleElements.forEach((text, index) => {
      if (text.trim()) {
        console.log(`  ${index}: "${text.trim()}"`);
      }
    });
    
    console.log('🏁 Quick UI verification completed');
  });
});