import { expect, test } from '@playwright/test';

test('opens Graph Lab and runs RETURN 1 in a browser', async ({ page }) => {
  await page.route('**/api/graphs', (route) => route.fulfill({
    json: { graphs: ['graph_lab'] },
  }));

  let submitted: { graph: string; cypher: string } | undefined;
  await page.route('**/api/query', (route) => {
    submitted = route.request().postDataJSON();
    return route.fulfill({
      json: { columns: ['value'], rows: [[1]], graph: { nodes: [], edges: [] }, durationMs: 1 },
    });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Graph Lab' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Graph' })).toHaveValue('graph_lab');

  await page.locator('.monaco-editor').click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('RETURN 1');
  await page.getByRole('button', { name: 'Run query' }).click();

  await expect(page.getByRole('cell', { name: '1' })).toBeVisible();
  expect(submitted).toEqual({ graph: 'graph_lab', cypher: 'RETURN 1' });
});
