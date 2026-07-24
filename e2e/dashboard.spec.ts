import { test, expect } from '@playwright/test';

test.describe('SNOW Analytics E2E Workflow', () => {
  test('should display login form, allow navigating to register, and validate credentials fields', async ({ page }) => {
    await page.goto('/');

    // Verify brand heading
    await expect(page.locator('h1')).toContainText('SNOW Intelligence');

    // Check input presence
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Verify button label
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toContainText('Sign In to Workspace');

    // Toggle registration view
    const signUpToggle = page.locator('button:has-text("Sign up")');
    await signUpToggle.click();

    // Verify toggle response
    await expect(submitBtn).toContainText('Create Developer Account');
  });

  test('should login as demo user, load the mock dashboard, and navigate to AI Insights', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Click the login button (which triggers offline mock login)
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Wait for dashboard to load by looking for the KPI panel
    // The dataset is "Sample Analytics (Mock)"
    await expect(page.locator('text=Sample Analytics (Mock)')).toBeVisible({ timeout: 10000 });

    // Verify main dashboard components are present
    await expect(page.locator('text=Executive Summary')).toBeVisible();
    await expect(page.locator('text=Geographic Intelligence')).toBeVisible();

    // Navigate to the "Snow AI" section via sidebar
    const snowAiLink = page.locator('button:has-text("Snow AI")');
    await snowAiLink.click();

    // Wait for the Insights Center to mount
    await expect(page.locator('text=AI Insights Center')).toBeVisible();

    // Verify AI features exist
    await expect(page.locator('text=Copilot')).toBeVisible();
    await expect(page.locator('text=Forecast')).toBeVisible();
    
    // Click Forecast tab
    await page.locator('button:has-text("Forecast")').click();
    
    // Verify forecast engine loads
    await expect(page.locator('text=Forecast Model Engine')).toBeVisible();
  });
});
