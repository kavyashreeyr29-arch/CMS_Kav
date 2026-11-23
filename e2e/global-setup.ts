import { chromium, FullConfig } from '@playwright/test';

/**
 * Vite's dev server does its first real bundle/dependency-optimize pass on
 * the first navigation that hits it — on this host (limited RAM, whole
 * Docker Compose stack running alongside) that cold start was slower than
 * a fresh test's default timeout, making whichever test ran first fail with
 * a stale/half-loaded page while every later test (server now warm) passed.
 * One throwaway navigation here, before the real suite starts, absorbs that
 * cost outside of any individual test's timeout.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL ?? 'http://localhost:5173';
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${baseURL}/login`, { timeout: 60000, waitUntil: 'load' });
  await page.getByRole('button', { name: 'Sign in' }).waitFor({ timeout: 60000 });
  await browser.close();
}
