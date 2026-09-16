import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setExtraHTTPHeaders({ 'X-Development-User': 'test-user@example.com' });
  
  await page.goto('http://localhost:5173/applications', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  
  const links = await page.$$('a');
  for (const link of links) {
    const text = await page.evaluate(el => el.textContent, link);
    if (text.includes('Action Corp')) {
      console.log('[Action] Clicking application link:', text.replace(/\n/g, ' '));
      
      const href = await page.evaluate(el => el.href, link);
      console.log('Navigating to', href);
      await page.goto(href, { waitUntil: 'networkidle2' });
      break;
    }
  }
  await new Promise(r => setTimeout(r, 1000));
  let detailText = await page.evaluate(() => document.body.innerText);
  console.log('[UI] Detail Page Timeline Section:', detailText.includes('Timeline') ? 'YES' : 'NO');
  
  await browser.close();
})();
