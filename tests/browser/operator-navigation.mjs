export async function openOperatorRoute(page, path) {
  const link = page.locator(`a[href="${path}"]:visible`).first()
  if (!await link.count()) await page.locator('header summary').click()
  await link.click()
  await page.waitForURL(url => url.pathname === path)
  await page.locator('main h1').waitFor()
}
