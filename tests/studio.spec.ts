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
    if (equipment === 'Cone') {
      await page.getByRole('button', { name: 'Equipment', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Player', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Mini goal', exact: true })).toBeVisible();
    }
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
    await page.getByRole('button', { name: 'Equipment', exact: true }).tap();
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
    const moved = await endpoint.getAttribute('transform');
    await page.getByLabel('Exercise title').fill('Tablet exercise');
    await page.getByRole('button', { name: 'Save exercise' }).click();
    await expect(page.getByRole('status')).toHaveText('Saved');
    await page.reload();
    await page.getByRole('button', { name: 'Tablet exercise private' }).tap();
    await expect(endpoint).toHaveAttribute('transform', moved!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(820);
  });
});

test('animate a run and pass, then replay the saved exercise and share it', async ({ page, browser }) => {
  await register(page);
  await page.getByLabel('Exercise title').fill('Run and pass');
  await page.getByRole('button', { name: 'Player', exact: true }).click();
  await clickField(page, .3, .4);
  await page.getByRole('button', { name: 'Ball', exact: true }).click();
  await clickField(page, .4, .65);
  const editor = page.getByRole('region', { name: 'Diagram editor' });
  const player = editor.locator('[data-kind=player] > g');
  const ball = editor.locator('[data-kind=ball] > g');
  const initialPlayer = await player.getAttribute('transform');
  const initialBall = await ball.getAttribute('transform');
  await page.getByRole('button', { name: 'Next moment' }).click();
  const moments = page.getByLabel('Moment', { exact: true });
  await expect(moments).toHaveValue('1');
  const duration = page.getByLabel('Seconds from previous moment');
  await duration.fill('2');
  await duration.press('Enter');

  async function drag(from: [number, number], to: [number, number]) {
    const start = await fieldPoint(page, ...from);
    const end = await fieldPoint(page, ...to);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 5 });
    await page.mouse.up();
  }
  await drag([.3, .4], [.6, .4]);
  const finalPlayer = await player.getAttribute('transform');
  expect(finalPlayer).not.toBe(initialPlayer);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(player).toHaveAttribute('transform', initialPlayer!);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(player).toHaveAttribute('transform', finalPlayer!);
  await page.getByRole('button', { name: 'Next moment' }).click();
  await drag([.4, .65], [.7, .65]);
  const finalBall = await ball.getAttribute('transform');
  expect(finalBall).not.toBe(initialBall);
  await expect(player).toHaveAttribute('transform', finalPlayer!);

  await moments.selectOption('0');
  await expect(player).toHaveAttribute('transform', initialPlayer!);
  await expect(ball).toHaveAttribute('transform', initialBall!);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(player).not.toHaveAttribute('transform', initialPlayer!);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(ball).toHaveAttribute('transform', finalBall!);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(player).toHaveAttribute('transform', initialPlayer!);

  await page.getByText('Exercise details', { exact: true }).click();
  await page.getByLabel('Visibility').selectOption('unlisted');
  await page.getByRole('button', { name: 'Save exercise' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved');
  const link = await page.getByRole('link', { name: 'Open sharing link' }).getAttribute('href');
  await page.reload();
  await page.getByRole('button', { name: 'Run and pass unlisted' }).click();
  await moments.selectOption('2');
  await expect(player).toHaveAttribute('transform', finalPlayer!);
  await expect(ball).toHaveAttribute('transform', finalBall!);
  await moments.selectOption('1');
  await expect(duration).toHaveValue('2');
  await page.getByRole('button', { name: 'Delete moment' }).click();
  await moments.selectOption('1');
  await expect(player).toHaveAttribute('transform', finalPlayer!);
  await expect(ball).toHaveAttribute('transform', finalBall!);

  const guest = await browser.newPage();
  try {
    await guest.goto(new URL(link!, page.url()).href);
    await guest.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(guest.locator('[data-kind=ball] > g')).toHaveAttribute('transform', finalBall!);
  } finally {
    await guest.close();
  }
});
