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
});
