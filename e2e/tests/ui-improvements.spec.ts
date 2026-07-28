import { test, expect } from '@playwright/test';
import { login } from './fixtures';

// Coverage for the UI-improvement pass documented in CHANGELOG.md — mobile
// sidebar drawer, responsive grids, and a couple of keyboard-accessibility
// spot checks on controls that used to be non-focusable divs/spans.
test.describe('UI improvements — responsive & accessibility', () => {
  test('Desktop viewport: sidebar is always visible, no hamburger menu shown', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.menu-btn')).not.toBeVisible();
  });

  test('Mobile viewport: sidebar starts hidden, hamburger opens it as a drawer, backdrop closes it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    const sidebar = page.locator('.sidebar');
    await expect(sidebar).not.toBeInViewport();

    await page.locator('.menu-btn').click();
    await expect(sidebar).toHaveClass(/open/);
    await expect(sidebar).toBeInViewport();

    // The backdrop covers the full viewport (`inset: 0`), but the sidebar
    // itself (216px wide) sits on top of its left portion — Playwright's
    // default center-click on a 390px-wide viewport would land inside the
    // sidebar, not the backdrop. Click a point clearly to the right of it.
    await page.locator('.sidebar-backdrop').click({ position: { x: 350, y: 400 } });
    await expect(sidebar).not.toHaveClass(/open/);
  });

  test('Mobile viewport: clicking a nav link inside the drawer closes it after navigating', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.locator('.menu-btn').click();
    await expect(page.locator('.sidebar')).toHaveClass(/open/);

    await page.locator('.sidebar-nav a[href="/tickets"]').click();
    await expect(page).toHaveURL(/\/tickets$/);
    await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
  });

  test('Mobile viewport: no horizontal overflow on Dashboard, Tickets, or Kanban', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    for (const path of ['/dashboard', '/tickets', '/kanban']) {
      await page.goto(path);
      // Each iteration is a full reload (page.goto, not an SPA nav click),
      // and the mobile @media rules that move .sidebar to `position: fixed`
      // apply asynchronously relative to first paint under Vite's dev-mode
      // JS-injected stylesheet — measuring immediately can catch a transient
      // frame where the sidebar is still in normal flow. Wait for it to
      // settle into its off-canvas position before measuring.
      await expect(page.locator('.sidebar')).not.toBeInViewport();
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth, `${path} should not overflow horizontally`).toBeLessThanOrEqual(clientWidth + 1);
    }
  });

  test('Modal close, notification bell, and account menu are real keyboard-focusable buttons', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);

    await expect(page.locator('.bell')).toHaveJSProperty('tagName', 'BUTTON');
    await expect(page.locator('.role-switcher')).toHaveJSProperty('tagName', 'BUTTON');

    await page.locator('.btn-primary', { hasText: 'New ticket' }).click();
    const closeBtn = page.locator('.modal-close');
    await expect(closeBtn).toHaveJSProperty('tagName', 'BUTTON');
    await expect(closeBtn).toHaveAttribute('aria-label', 'Close');
    await closeBtn.click();
  });
});
