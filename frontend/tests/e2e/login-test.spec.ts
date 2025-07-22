import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should login successfully with eval@lumenarc.ai credentials', async ({ page }) => {
    // Navigate to the frontend URL
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Look for login form elements
    await page.waitForSelector('input[type="email"], input[placeholder*="email" i]', { timeout: 10000 });
    
    // Fill in the email field
    const emailField = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await emailField.fill('eval@lumenarc.ai');
    
    // Fill in the password field
    const passwordField = page.locator('input[type="password"], input[placeholder*="password" i]').first();
    await passwordField.fill('@Evalaccount1');
    
    // Click the login button
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign in"), button[type="submit"]').first();
    await loginButton.click();
    
    // Wait for login to complete - look for the interface you showed in the image
    await page.waitForSelector('text="Lumen Transcript Cleaner"', { timeout: 15000 });
    
    // Verify we see the main interface elements from your screenshot
    await expect(page.locator('text="Lumen Transcript Cleaner"')).toBeVisible();
    await expect(page.locator('text="No Conversation Loaded"')).toBeVisible();
    await expect(page.locator('button:has-text("Load Conversation")')).toBeVisible();
    // Understanding the Results section was removed
    
    // Take a screenshot to verify the login succeeded
    await page.screenshot({ path: 'login-success.png' });
    
    console.log('✅ Login test passed - successfully logged in with eval@lumenarc.ai');
  });
  
  test('should handle invalid credentials gracefully', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Try with invalid credentials
    await page.waitForSelector('input[type="email"], input[placeholder*="email" i]', { timeout: 10000 });
    
    const emailField = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    await emailField.fill('invalid@test.com');
    
    const passwordField = page.locator('input[type="password"], input[placeholder*="password" i]').first();
    await passwordField.fill('wrongpassword');
    
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign in"), button[type="submit"]').first();
    await loginButton.click();
    
    // Should show error message or stay on login page
    await page.waitForTimeout(2000);
    
    // Verify we're still on login page or see error message
    const hasError = await page.locator('text="Invalid", text="Error", text="Failed"').first().isVisible().catch(() => false);
    const stillOnLogin = await page.locator('input[type="email"], input[placeholder*="email" i]').first().isVisible().catch(() => false);
    
    expect(hasError || stillOnLogin).toBe(true);
    
    console.log('✅ Invalid credentials test passed - login properly rejected');
  });
});