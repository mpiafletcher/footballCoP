import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

async function register(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Email').fill(`${randomUUID()}@example.com`);
  await page.getByLabel('Password').fill('football-test-password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Studio', exact: true })).toBeVisible();
}

async function fieldPoint(page: Page, x: number, y: number) {
  return page.locator('.field-panel .pitch > g').first().evaluate((field, coordinates) => {
    const boundary = field.querySelector('rect[rx]')!;
    const padding = -Number(boundary.getAttribute('x'));
    const length = Number(boundary.getAttribute('width')) - 2 * padding;
    const width = Number(boundary.getAttribute('height')) - 2 * padding;
    const screen = new DOMPoint(coordinates.x * length, coordinates.y * width).matrixTransform((field as SVGGElement).getScreenCTM()!);
    return { x: screen.x, y: screen.y };
  }, { x, y });
}

async function clickField(page: Page, x: number, y: number) {
  const point = await fieldPoint(page, x, y);
  await page.mouse.click(point.x, point.y);
}

test('desktop coach edits, exports, saves, reloads and saves again', async ({ page }) => {
  await register(page);
  await page.getByLabel('Exercise title').fill('Transition practice');
  await page.getByLabel('Pitch preset').selectOption('custom');
  await page.getByRole('button', { name: 'Player', exact: true }).click();
  for (let index = 0; index < 10; index++) await clickField(page, .15 + index % 5 * .16, index < 5 ? .29 : .7);
  for (const [index, equipment] of ['Ball', 'Cone', 'Full-size goal'].entries()) {
    await page.getByRole('button', { name: equipment, exact: true }).click();
    await clickField(page, .35 + index * .15, .48);
  }
  await expect(page.locator('[data-kind=player]')).toHaveCount(10);
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  const start = await fieldPoint(page, .15, .29);
  const end = await fieldPoint(page, .24, .39);
  const first = page.locator('[data-kind=player]').first().locator(':scope > g');
  const before = await first.getAttribute('transform');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 6 });
  await page.mouse.up();
  const after = await first.getAttribute('transform');
  expect(after).not.toBe(before);
  await page.keyboard.press('Control+z');
  await expect(first).toHaveAttribute('transform', before!);
  await page.keyboard.press('Control+Shift+z');
  await expect(first).toHaveAttribute('transform', after!);
  await page.getByLabel('Element colour').fill('#d1387f');
  await expect(first.locator('circle[fill="#d1387f"]')).toHaveCount(1);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG' }).click();
  expect((await download).suggestedFilename()).toBe('Transition practice.png');
  await page.getByRole('button', { name: 'Save exercise' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
  await page.reload();
  await page.getByRole('button', { name: 'Transition practice private' }).click();
  await expect(page.locator('[data-element]')).toHaveCount(13);
  await expect(first).toHaveAttribute('transform', after!);
  await expect(first.locator('circle[fill="#d1387f"]')).toHaveCount(1);
  await page.getByLabel('Exercise title').fill('Transition practice updated');
  await page.getByRole('button', { name: 'Save exercise' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
  await page.reload();
  await page.getByRole('button', { name: 'Transition practice updated private' }).click();
  await expect(page.locator('[data-element]')).toHaveCount(13);
});

test.describe('touch tablet', () => {
  test.use({ viewport: { width: 820, height: 1050 }, hasTouch: true, isMobile: true });

  test('taps and drags on a vertical pitch with proportional custom dimensions', async ({ page }) => {
    await register(page);
    await page.getByLabel('Pitch preset').selectOption('custom');
    await page.getByText('Pitch settings', { exact: true }).tap();
    await page.getByLabel('Pitch length').fill('42');
    await page.getByLabel('Pitch width').fill('19');
    await page.getByLabel('Orientation').selectOption('vertical');
    await page.getByText('Pitch settings', { exact: true }).tap();
    const origin = await fieldPoint(page, .2, .2);
    const alongLength = await fieldPoint(page, .7, .2);
    const alongWidth = await fieldPoint(page, .2, .7);
    expect((alongLength.y - origin.y) / (origin.x - alongWidth.x)).toBeCloseTo(42 / 19, 5);
    await page.getByRole('button', { name: 'Cone', exact: true }).tap();
    await page.touchscreen.tap(origin.x, origin.y);
    await expect(page.locator('[data-kind=cone]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Select', exact: true }).tap();
    const end = await fieldPoint(page, .45, .36);
    const endpoint = page.locator('[data-kind=cone] > g');
    const original = await endpoint.getAttribute('transform');
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [origin] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(endpoint).not.toHaveAttribute('transform', original!);
    await page.getByRole('button', { name: 'Undo', exact: true }).tap();
    await expect(endpoint).toHaveAttribute('transform', original!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(820);
  });
});
