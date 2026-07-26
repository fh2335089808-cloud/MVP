import { expect, test } from '@playwright/test';

test('first successful submission immediately renders the success card', async ({ page }) => {
  const runtimeErrors: Error[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error));

  await page.route('**/api/order/submit', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        duplicate: false,
        recordId: 'rec_component_test',
        message: '登记已收到，工作人员会尽快联系您确认。',
      }),
    });
  });

  await page.goto('/?source=official');
  await page.getByLabel('姓名').fill('首次成功组件测试');
  await page.getByLabel('联系电话').fill('13800000000');
  await page.getByLabel('鸡枞菌').click();
  await page.getByText('500g', { exact: true }).click();
  await page.getByText('官渡区同城配送', { exact: true }).click();
  await page.getByLabel('官渡区配送地址').fill('测试地址');
  await page.getByText('明天', { exact: true }).click();
  await page.getByRole('button', { name: '提交登记' }).click();

  await expect(page.getByRole('heading', { name: '登记已收到' })).toBeVisible();
  await expect(page.getByText('工作人员会尽快联系您确认。')).toBeVisible();
  await expect(page.getByRole('link', { name: '返回首页' })).toHaveAttribute(
    'href',
    'https://www.kunming-mushroom.asia',
  );
  await expect(page.getByRole('button', { name: '提交登记' })).toHaveCount(0);
  expect(runtimeErrors).toEqual([]);
});