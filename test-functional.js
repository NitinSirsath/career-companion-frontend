import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setExtraHTTPHeaders({ 'X-Development-User': 'test-user@example.com' });
  
  // 1. Applications -> Ambiguous Match -> Ignore
  await page.goto('http://localhost:5173/applications', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  
  let buttons = await page.$$('button');
  for (const btn of buttons) {
    if (await page.evaluate(el => el.textContent, btn) === 'Not related to any application') {
      console.log('[Action] Clicking "Not related to any application"');
      await btn.click(); break;
    }
  }
  await new Promise(r => setTimeout(r, 1000));
  
  // 2. Actions -> Dismiss
  buttons = await page.$$('button');
  for (const btn of buttons) {
    if (await page.evaluate(el => el.textContent, btn) === 'Dismiss') {
      console.log('[Action] Clicking "Dismiss" action');
      await btn.click(); break;
    }
  }
  await new Promise(r => setTimeout(r, 1000));
  
  let text = await page.evaluate(() => document.body.innerText);
  console.log('[UI] Remaining Needs Review:', text.includes('Needs Review'));
  console.log('[UI] Remaining OVERDUE:', text.includes('OVERDUE'));
  
  // 3. Application Detail
  const links = await page.$$('a');
  for (const link of links) {
    if (await page.evaluate(el => el.textContent, link) === 'Action Corp2 actionsEngineerAdded Sep 16') {
      console.log('[Action] Clicking application link');
      await link.click(); break;
    }
  }
  await new Promise(r => setTimeout(r, 1000));
  let detailText = await page.evaluate(() => document.body.innerText);
  console.log('[UI] Detail Page Title:', detailText.substring(0, 500));
  
  await browser.close();
})();
