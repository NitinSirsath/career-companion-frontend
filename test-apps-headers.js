import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setExtraHTTPHeaders({
    'X-Development-User': 'test-user@example.com'
  });
  
  await page.goto('http://localhost:5173/applications', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('[UI] Initial text:');
  console.log(bodyText);
  
  await browser.close();
})();
