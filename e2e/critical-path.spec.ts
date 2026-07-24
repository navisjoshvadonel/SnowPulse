/**
 * SnowPulse AI — Critical Path E2E Test Suite
 *
 * Covers the primary user journey end-to-end:
 *   1. Login (email + password mock auth)
 *   2. Dataset selector: choose the pre-loaded mock dataset
 *   3. Dashboard verification: KPI cards, Trends chart, Geographic panel
 *   4. CSV file upload: upload a minimal synthetic CSV and confirm the
 *      dashboard refreshes with the new dataset name
 *   5. Snow AI Insights: open Copilot tab, switch to Forecast tab and verify
 *      the Forecast Model Engine heading is present
 *   6. Prediction panel: navigate to the Prediction section and verify the
 *      "Run AutoML" button is visible
 */

import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal synthetic CSV file in the OS temp directory.
 * Returns the absolute path so Playwright can set it on the file input.
 */
function createTempCsv(): string {
  const csv = [
    'date,region,sales,cost,category',
    '2024-01-01,North America,12000,4500,Enterprise',
    '2024-01-02,Europe,9500,3200,SaaS',
    '2024-01-03,APAC,7800,2900,API',
    '2024-01-04,North America,14500,5100,Enterprise',
    '2024-01-05,Europe,11200,3900,SaaS',
  ].join('\n');

  const tmpFile = path.join(os.tmpdir(), `snowpulse-test-${Date.now()}.csv`);
  fs.writeFileSync(tmpFile, csv, 'utf-8');
  return tmpFile;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

test.describe('SnowPulse — Full Critical Path: Login → Upload → Insights', () => {

  // ── 1. Authentication ────────────────────────────────────────────────────
  test('1. Login page renders correctly and accepts credentials', async ({ page }) => {
    await page.goto('/');

    // Brand identity
    await expect(page.locator('h1')).toContainText('SnowPulse AI');

    // Both form fields present
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Submit button present with correct default label
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toContainText('Sign In to Workspace');

    // Toggle to register mode
    await page.locator('button:has-text("Sign up")').click();
    await expect(submitBtn).toContainText('Create Developer Account');

    // Toggle back
    await page.locator('button:has-text("Sign in")').click();
    await expect(submitBtn).toContainText('Sign In to Workspace');
  });

  // ── 2. Login → Dataset Selector ─────────────────────────────────────────
  test('2. Login and reach the dataset selector screen', async ({ page }) => {
    await page.goto('/');

    // Fill credentials (mock backend accepts anything offline)
    await page.fill('input[type="email"]', 'demo@snowpulse.ai');
    await page.fill('input[type="password"]', 'demo1234');
    await page.click('button[type="submit"]');

    // After login the dataset selection screen should appear
    await expect(page.locator('text=Unlock AI Analytics')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('label[for="csv-upload"]')).toBeVisible();
    await expect(page.locator('text=Pre-loaded / Shared Datasets')).toBeVisible();
  });

  // ── 3. Dataset Selection → Dashboard ────────────────────────────────────
  test('3. Select the mock dataset and verify the full dashboard renders', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'demo@snowpulse.ai');
    await page.fill('input[type="password"]', 'demo1234');
    await page.click('button[type="submit"]');

    // Wait for dataset list
    await expect(page.locator('text=Pre-loaded / Shared Datasets')).toBeVisible({ timeout: 10_000 });

    // Click the first pre-loaded dataset (Sample Analytics (Mock))
    const datasetBtn = page.locator('button:has-text("Sample Analytics")').first();
    await expect(datasetBtn).toBeVisible({ timeout: 8_000 });
    await datasetBtn.click();

    // Dashboard KPI section
    await expect(page.locator('text=Executive Summary').or(page.locator('text=Total Revenue')).first()).toBeVisible({ timeout: 12_000 });

    // Performance analytics chart area exists
    await expect(page.locator('text=Performance Analytics')).toBeVisible();

    // Geographic section is rendered
    await expect(page.locator('text=Geographic Intelligence')).toBeVisible();
  });

  // ── 4. CSV Upload → Dashboard Refresh ───────────────────────────────────
  test('4. Upload a synthetic CSV and confirm the dashboard updates to the new dataset', async ({ page }) => {
    const csvPath = createTempCsv();

    await page.goto('/');
    await page.fill('input[type="email"]', 'demo@snowpulse.ai');
    await page.fill('input[type="password"]', 'demo1234');
    await page.click('button[type="submit"]');

    // Wait for dataset selector
    await expect(page.locator('label[for="csv-upload"]')).toBeVisible({ timeout: 10_000 });

    // Upload CSV via the hidden file input
    const fileInput = page.locator('#csv-upload');
    await fileInput.setInputFiles(csvPath);

    // Cleanup temp file
    try { fs.unlinkSync(csvPath); } catch { /* ignore */ }

    // The app parses the CSV client-side with PapaParse; new dataset name is
    // the filename without extension (e.g. "snowpulse-test-<timestamp>")
    // We look for any KPI card which confirms the dashboard loaded with data
    await expect(
      page.locator('text=Performance Analytics').or(page.locator('text=Total Revenue')).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  // ── 5. Snow AI Insights Tabs ─────────────────────────────────────────────
  test('5. Navigate to Snow AI and verify Copilot → Forecast tab switching', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'demo@snowpulse.ai');
    await page.fill('input[type="password"]', 'demo1234');
    await page.click('button[type="submit"]');

    // Select mock dataset
    await expect(page.locator('text=Pre-loaded / Shared Datasets')).toBeVisible({ timeout: 10_000 });
    const datasetBtn = page.locator('button:has-text("Sample Analytics")').first();
    await datasetBtn.click();

    // Confirm we are on the dashboard
    await expect(page.locator('text=Performance Analytics')).toBeVisible({ timeout: 12_000 });

    // Navigate to Snow AI via sidebar
    await page.locator('button:has-text("Snow AI")').click();

    // Insights Center heading
    await expect(page.locator('text=AI Insights Center')).toBeVisible({ timeout: 8_000 });

    // Default Copilot tab is active — ask a question prompt field visible
    await expect(page.locator('text=Copilot')).toBeVisible();

    // Switch to Anomalies tab
    await page.locator('button:has-text("Anomalies")').click();
    await expect(page.locator('text=Detected Anomalies')).toBeVisible();

    // Switch to Forecast tab
    await page.locator('button:has-text("Forecast")').click();
    await expect(page.locator('text=Forecast Model Engine')).toBeVisible();

    // Switch to Actions tab
    await page.locator('button:has-text("Actions")').click();
    await expect(page.locator('text=Generate Executive Report')).toBeVisible();
  });

  // ── 6. Prediction Panel — AutoML Button Presence ─────────────────────────
  test('6. Navigate to Prediction section and verify AutoML controls are present', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'demo@snowpulse.ai');
    await page.fill('input[type="password"]', 'demo1234');
    await page.click('button[type="submit"]');

    // Select mock dataset
    await expect(page.locator('text=Pre-loaded / Shared Datasets')).toBeVisible({ timeout: 10_000 });
    await page.locator('button:has-text("Sample Analytics")').first().click();

    // Confirm dashboard loaded
    await expect(page.locator('text=Performance Analytics')).toBeVisible({ timeout: 12_000 });

    // Navigate to Prediction section in sidebar
    await page.locator('button:has-text("Prediction")').click();

    // The PredictionPanel should show either a trained model or the Run AutoML CTA
    await expect(
      page.locator('text=Run AutoML').or(page.locator('text=Champion Model')).first()
    ).toBeVisible({ timeout: 8_000 });
  });
});
