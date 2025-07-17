import { test, expect } from '@playwright/test';

test.describe('Simple Visibility Test', () => {
  test('should provide maximum visibility into the system state', async ({ page }) => {
    console.log('🚀 Starting Simple Visibility Test...');
    
    // Enable clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    
    // Capture network requests
    const networkLogs: string[] = [];
    page.on('request', (request) => {
      networkLogs.push(`REQUEST: ${request.method()} ${request.url()}`);
    });
    
    page.on('response', (response) => {
      networkLogs.push(`RESPONSE: ${response.status()} ${response.url()}`);
    });
    
    // Capture console logs
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });
    
    // Navigate to page
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
    if (!backendTest.success) {
      console.log('❌ Backend error:', backendTest.error);
    }
    
    // Check login page
    const isLoginPage = await page.locator('input[type="email"]').isVisible();
    console.log('🔍 Is login page:', isLoginPage);
    
    if (isLoginPage) {
      console.log('📋 Attempting login...');
      await page.fill('input[type="email"]', 'eval@lumenarc.ai');
      await page.fill('input[type="password"]', '@Evalaccount1');
      
      await page.screenshot({ path: 'test-results/before-login.png' });
      
      await page.click('button:has-text("Sign in")');
      
      await page.waitForTimeout(5000);
      
      await page.screenshot({ path: 'test-results/after-login.png' });
      
      // Check for errors
      const errorElement = page.locator('text="Failed to fetch"');
      const hasError = await errorElement.isVisible().catch(() => false);
      if (hasError) {
        console.log('❌ Login error: Failed to fetch');
      }
    }
    
    // Analyze page content
    const pageText = await page.locator('body').textContent();
    
    console.log('📊 Page Analysis:');
    console.log('  - Lumen Transcript Cleaner:', pageText?.includes('Lumen Transcript Cleaner') ? '✅' : '❌');
    console.log('  - sam 6,v2:', pageText?.includes('sam 6,v2') ? '✅' : '❌');
    console.log('  - Gemini v4:', pageText?.includes('Gemini v4') ? '✅' : '❌');
    console.log('  - No template:', pageText?.includes('No template') ? '✅' : '❌');
    console.log('  - Prompt:', pageText?.includes('Prompt:') ? '✅' : '❌');
    console.log('  - Copy Compact:', pageText?.includes('Copy Compact') ? '✅' : '❌');
    console.log('  - Load Conversation:', pageText?.includes('Load Conversation') ? '✅' : '❌');
    console.log('  - Failed to fetch:', pageText?.includes('Failed to fetch') ? '✅' : '❌');
    
    // Find all buttons
    const buttons = await page.locator('button').all();
    console.log('🔘 Buttons found:', buttons.length);
    for (let i = 0; i < buttons.length; i++) {
      const text = await buttons[i].textContent();
      const isVisible = await buttons[i].isVisible();
      console.log(`  ${i + 1}. "${text}" (visible: ${isVisible})`);
    }
    
    // Network analysis
    console.log('📡 Network requests:');
    networkLogs.slice(0, 10).forEach(log => console.log(`  ${log}`));
    
    // Console analysis
    console.log('📋 Console logs:');
    consoleLogs.slice(0, 10).forEach(log => console.log(`  ${log}`));
    
    // Manual backend test
    const authTest = await page.evaluate(async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'eval@lumenarc.ai', password: '@Evalaccount1' })
        });
        const data = await response.json();
        return { success: true, status: response.status, data };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('🔐 Auth test:', authTest.success ? '✅' : '❌');
    if (!authTest.success) {
      console.log('❌ Auth error:', authTest.error);
    }
    
    // Final screenshot
    await page.screenshot({ path: 'test-results/final-state.png', fullPage: true });
    
    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌐 Backend Connectivity:', backendTest.success ? '✅' : '❌');
    console.log('🔐 Authentication:', authTest.success ? '✅' : '❌');
    console.log('📄 Main Interface:', pageText?.includes('Load Conversation') ? '✅' : '❌');
    console.log('💬 SAM6V2 Conversation:', pageText?.includes('sam 6,v2') ? '✅' : '❌');
    console.log('🏷️ Gemini v4 Template:', pageText?.includes('Gemini v4') ? '✅' : '❌');
    console.log('📋 Copy Compact:', pageText?.includes('Copy Compact') ? '✅' : '❌');
    
    if (!backendTest.success) {
      console.log('❌ ROOT CAUSE: Backend not responding');
      console.log('🔧 SOLUTION: Start backend server');
    } else if (!authTest.success) {
      console.log('❌ ROOT CAUSE: Authentication failing');
      console.log('🔧 SOLUTION: Check auth configuration');
    } else if (!pageText?.includes('Load Conversation')) {
      console.log('❌ ROOT CAUSE: Main interface not loading');
      console.log('🔧 SOLUTION: Check login flow');
    } else {
      console.log('✅ System appears to be working correctly');
    }
    
    console.log('🏁 Simple Visibility Test completed');
  });
});