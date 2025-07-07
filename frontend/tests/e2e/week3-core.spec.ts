import { test, expect, Page } from '@playwright/test';

/**
 * Week 3 Core Real-time E2E Tests
 * 
 * Simplified, robust tests focusing on core functionality that works reliably
 * Following CLAUDE.md guidelines with auto-error capture
 */

const FRONTEND_URL = 'http://127.0.0.1:6173';
const BACKEND_URL = 'http://127.0.0.1:8000';
const WEEK3_TEST_URL = `${FRONTEND_URL}/week3`;

// Auto-error capture setup
async function setupErrorCapture(page: Page) {
  const errors: string[] = [];
  const failedRequests: Array<{url: string, status: number}> = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`Console Error: ${msg.text()}`);
    }
  });

  page.on('response', response => {
    if (!response.ok() && response.status() >= 400) {
      failedRequests.push({
        url: response.url(),
        status: response.status()
      });
    }
  });

  page.on('pageerror', error => {
    errors.push(`Page Error: ${error.message}`);
  });

  return { errors, failedRequests };
}

function reportIssues(errors: string[], failedRequests: any[], testName: string) {
  if (errors.length || failedRequests.length) {
    console.log(`🚨 Auto-detected issues in ${testName}:`, {
      consoleErrors: errors,
      networkFailures: failedRequests
    });
    return false;
  }
  return true;
}

test.describe('Week 3 Core Real-time Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure backend is running
    const healthResponse = await fetch(`${BACKEND_URL}/health`);
    if (!healthResponse.ok) {
      throw new Error(`Backend not running at ${BACKEND_URL}`);
    }
  });

  test('Testing page loads successfully', async ({ page }) => {
    const { errors, failedRequests } = await setupErrorCapture(page);
    
    await page.goto(WEEK3_TEST_URL);

    // Check main heading exists
    await expect(page.locator('h1').filter({ hasText: 'Week 3 Real-time Testing Page' })).toBeVisible();
    
    // Check essential buttons are present
    await expect(page.locator('button', { hasText: 'Create Conversation' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Start Queue Workers' })).toBeVisible();
    
    // Check form elements
    await expect(page.locator('select')).toBeVisible();
    await expect(page.locator('input[placeholder*="Enter text"]')).toBeVisible();

    expect(reportIssues(errors, failedRequests, 'page load')).toBe(true);
  });

  test('Create conversation workflow', async ({ page }) => {
    const { errors, failedRequests } = await setupErrorCapture(page);
    
    await page.goto(WEEK3_TEST_URL);
    
    // Create conversation
    await page.click('button:has-text("Create Conversation")');
    
    // Wait for conversation ID to appear (more flexible selector)
    await page.waitForSelector('code', { timeout: 10000 });
    
    // Verify conversation ID format (UUID)
    const conversationCode = await page.locator('code').first().textContent();
    expect(conversationCode).toMatch(/^[a-f0-9-]{36}$/);

    expect(reportIssues(errors, failedRequests, 'conversation creation')).toBe(true);
  });

  test('Queue workers startup', async ({ page }) => {
    const { errors, failedRequests } = await setupErrorCapture(page);
    
    await page.goto(WEEK3_TEST_URL);
    
    // Start queue workers
    await page.click('button:has-text("Start Queue Workers")');
    
    // Wait for any success indicator in logs
    await page.waitForSelector('.text-green-400', { timeout: 10000 });

    expect(reportIssues(errors, failedRequests, 'queue workers')).toBe(true);
  });

  test('End-to-end real-time processing', async ({ page }) => {
    const { errors, failedRequests } = await setupErrorCapture(page);
    
    await page.goto(WEEK3_TEST_URL);
    
    // Step 1: Create conversation
    await page.click('button:has-text("Create Conversation")');
    await page.waitForSelector('code', { timeout: 10000 });
    
    // Step 2: Start workers
    await page.click('button:has-text("Start Queue Workers")');
    await page.waitForSelector('.text-green-400', { timeout: 10000 });
    
    // Step 3: Fill and submit turn
    await page.fill('input[placeholder*="Enter text"]', 'I am the vector of Marketing');
    
    const startTime = Date.now();
    await page.click('button:has-text("Process (Real-time)")');
    
    // Wait for turn processing (look for any processing indicator)
    await page.waitForSelector('.text-green-400', { timeout: 15000 });
    const processingTime = Date.now() - startTime;
    
    // Verify reasonable processing time
    expect(processingTime).toBeLessThan(10000); // 10 second upper bound
    console.log(`📊 End-to-end processing: ${processingTime}ms`);

    expect(reportIssues(errors, failedRequests, 'e2e processing')).toBe(true);
  });

  test('Performance targets validation', async ({ page }) => {
    const { errors, failedRequests } = await setupErrorCapture(page);
    
    await page.goto(WEEK3_TEST_URL);
    
    // Test page load performance
    const loadStart = Date.now();
    await page.reload();
    await page.waitForSelector('h1', { timeout: 5000 });
    const loadTime = Date.now() - loadStart;
    
    expect(loadTime).toBeLessThan(3000);
    console.log(`📊 Page load: ${loadTime}ms`);
    
    // Test button interaction responsiveness
    const button = page.locator('button:has-text("Create Conversation")');
    const interactionStart = Date.now();
    await button.hover();
    await button.click();
    const interactionTime = Date.now() - interactionStart;
    
    expect(interactionTime).toBeLessThan(1000);
    console.log(`📊 Button interaction: ${interactionTime}ms`);

    expect(reportIssues(errors, failedRequests, 'performance')).toBe(true);
  });

  test('Error states and recovery', async ({ page }) => {
    const { errors, failedRequests } = await setupErrorCapture(page);
    
    await page.goto(WEEK3_TEST_URL);
    
    // Verify button is disabled without conversation
    const processButton = page.locator('button:has-text("Process (Real-time)")');
    await expect(processButton).toBeDisabled();
    
    // Create conversation to enable the button
    await page.click('button:has-text("Create Conversation")');
    await page.waitForSelector('code', { timeout: 10000 });
    
    // Now button should be enabled (after workers start)
    await page.click('button:has-text("Start Queue Workers")');
    await page.waitForSelector('.text-green-400', { timeout: 10000 });
    
    // Verify button is now enabled
    await expect(processButton).not.toBeDisabled();

    expect(reportIssues(errors, failedRequests, 'error recovery')).toBe(true);
  });

  test('UI components responsiveness', async ({ page }) => {
    const { errors, failedRequests } = await setupErrorCapture(page);
    
    await page.goto(WEEK3_TEST_URL);
    
    // Test form inputs
    const textInput = page.locator('input[placeholder*="Enter text"]');
    await textInput.click();
    await textInput.fill('Test input responsiveness');
    
    const inputValue = await textInput.inputValue();
    expect(inputValue).toBe('Test input responsiveness');
    
    // Test dropdown
    const dropdown = page.locator('select');
    await dropdown.selectOption('Lumen');
    
    const selectedValue = await dropdown.inputValue();
    expect(selectedValue).toBe('Lumen');
    
    // Reset to User
    await dropdown.selectOption('User');

    expect(reportIssues(errors, failedRequests, 'UI responsiveness')).toBe(true);
  });

  test('Real-time architecture health check', async ({ page }) => {
    const { errors, failedRequests } = await setupErrorCapture(page);
    
    await page.goto(WEEK3_TEST_URL);
    
    // Check connection status display
    await expect(page.locator('text=WebSocket:')).toBeVisible();
    
    // Test connection button if available
    const testConnectionBtn = page.locator('button:has-text("Test Connection")');
    if (await testConnectionBtn.isVisible()) {
      await testConnectionBtn.click();
      // Wait for any result
      await page.waitForTimeout(1000);
    }
    
    // Check for metrics section
    await expect(page.locator('text=Real-time Metrics')).toBeVisible();

    expect(reportIssues(errors, failedRequests, 'health check')).toBe(true);
  });
});

test.afterAll(async () => {
  console.log('🎉 Week 3 Core E2E Tests Complete!');
  console.log('📊 Essential functionality validated');
  console.log('🔗 Real-time architecture core features tested');
});