import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('response', response => {
    if (response.url().includes('/api/gmail/sync')) {
      console.log(`[Network] POST /api/gmail/sync - Status: ${response.status()}`);
    }
  });
  
  await page.goto('http://localhost:5173/gmail', { waitUntil: 'networkidle2' });
  
  // Wait for the UI to show connection status
  await new Promise(r => setTimeout(r, 1000));
  
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('[UI] Initial text:');
  console.log(bodyText.substring(0, 500));
  
  // Look for "Sync Now" button
  const buttons = await page.$$('button');
  let syncButton = null;
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('Sync Now') || text.includes('Sync')) {
      syncButton = btn;
      console.log(`[Action] Found Sync button: ${text}`);
      break;
    }
  }
  
  if (syncButton) {
    await syncButton.click();
    console.log('[Action] Clicked Sync button');
    
    // Wait for a bit for the sync to complete
    await new Promise(r => setTimeout(r, 4000));
    
    const bodyTextAfter = await page.evaluate(() => document.body.innerText);
    console.log('[UI] Text after sync:');
    console.log(bodyTextAfter.substring(0, 500));
  } else {
    console.log('[Error] Could not find Sync button');
  }
  
  await browser.close();
})();
