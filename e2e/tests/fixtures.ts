import { Page } from '@playwright/test';

// Matches backend/prisma/seed.ts — the seed script's fixed demo password.
export const SEED_PASSWORD = 'password123';
export const SEED_ADMIN_EMAIL = 'pmanager@elevatohub.io';

export async function login(page: Page, email: string = SEED_ADMIN_EMAIL, password: string = SEED_PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Wait for the redirect so callers never race the async login() call in
  // AuthContext — without this, a subsequent page.goto() can land before the
  // token is persisted and bounce straight back to /login.
  await page.waitForURL(/\/(dashboard|my-board|tickets)/);
}
