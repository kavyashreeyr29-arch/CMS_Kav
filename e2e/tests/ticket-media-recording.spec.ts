import { test, expect } from '@playwright/test';

// Coverage for MediaRecorderCapture (CreateTicketModal) — voice-note and
// video-note recording during ticket creation, using Chromium's fake
// media-stream device (wired in playwright.config.ts) so getUserMedia()
// resolves headlessly instead of hanging on a permission prompt. Also covers
// the live-recording indicator (CHANGELOG.md "how will a user know it's
// recording") — a REC badge + live preview, not just a color change.
test.describe('Ticket creation — voice/video recording', () => {
  test('Recording a voice note shows a live REC indicator, then attaches the clip', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Admin', exact: true }).click();
    await page.waitForURL(/\/(dashboard|tickets)$/);

    await page.locator('.btn-primary', { hasText: 'New ticket' }).click();
    await expect(page.locator('.modal-title', { hasText: 'New ticket' })).toBeVisible();

    const title = `E2E voice note ticket ${Date.now()}`;
    await page.locator('.modal .field:has(label:text-is("Title")) input').fill(title);

    await page.locator('.select-pill', { hasText: 'Record voice note' }).click();
    await expect(page.locator('.recorder-rec-badge', { hasText: 'REC' })).toBeVisible();
    await expect(page.locator('.recorder-level-meter')).toBeVisible();
    await page.waitForTimeout(1200);
    await page.locator('.recorder-live .btn-destructive', { hasText: 'Stop recording' }).click();

    await expect(page.locator('.recorder-preview audio')).toBeVisible();
    await page.locator('.recorder-preview .btn-primary', { hasText: 'Attach voice note' }).click();
    await expect(page.locator('.recorder-preview')).toHaveCount(0);
    await expect(page.locator('.status-chip', { hasText: /\.webm$/ })).toBeVisible();

    await page.locator('.modal-foot .btn-primary', { hasText: 'Create & notify' }).click();
    await expect(page).toHaveURL(/\/tickets\/.+/, { timeout: 15000 });
    await expect(page.locator('.att-grid')).toContainText('voice-note-');
  });

  test('Recording a video note shows a live camera preview, then attaches the clip', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Admin', exact: true }).click();
    await page.waitForURL(/\/(dashboard|tickets)$/);

    await page.locator('.btn-primary', { hasText: 'New ticket' }).click();
    await expect(page.locator('.modal-title', { hasText: 'New ticket' })).toBeVisible();

    const title = `E2E video note ticket ${Date.now()}`;
    await page.locator('.modal .field:has(label:text-is("Title")) input').fill(title);

    await page.locator('.select-pill', { hasText: 'Record video' }).click();
    await expect(page.locator('.recorder-rec-badge', { hasText: 'REC' })).toBeVisible();
    await expect(page.locator('.recorder-live-video')).toBeVisible();
    await page.waitForTimeout(1200);
    await page.locator('.recorder-live .btn-destructive', { hasText: 'Stop recording' }).click();

    await expect(page.locator('.recorder-preview video')).toBeVisible();
    await page.locator('.recorder-preview .btn-primary', { hasText: 'Attach video' }).click();
    await expect(page.locator('.recorder-preview')).toHaveCount(0);
    await expect(page.locator('.status-chip', { hasText: /\.webm$/ })).toBeVisible();

    await page.locator('.modal-foot .btn-primary', { hasText: 'Create & notify' }).click();
    await expect(page).toHaveURL(/\/tickets\/.+/, { timeout: 15000 });
    await expect(page.locator('.att-grid')).toContainText('video-note-');
  });
});
