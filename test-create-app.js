import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.setExtraHTTPHeaders({
    'X-Development-User': 'test-user@example.com'
  });
  
  await page.goto('http://localhost:5173/applications', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  
  let text = await page.evaluate(() => document.body.innerText);
  console.log('[UI] Form hidden initially:', !text.includes('Company Name *'));
  
  const addBtns = await page.$$('button');
  let addBtn = null;
  for (const btn of addBtns) {
    if (await page.evaluate(el => el.textContent, btn) === '+ Add Application') {
      addBtn = btn; break;
    }
  }
  
  if (addBtn) {
    await addBtn.click();
    await new Promise(r => setTimeout(r, 500));
    
    let textAfter = await page.evaluate(() => document.body.innerText);
    console.log('[UI] Form visible after click:', textAfter.includes('Company Name *'));
    
    // Submit empty
    const allBtns = await page.$$('button');
    let saveBtn = null;
    for (const btn of allBtns) {
      if (await page.evaluate(el => el.textContent, btn) === 'Save Application') {
        saveBtn = btn; break;
      }
    }
    
    await saveBtn.click();
    await new Promise(r => setTimeout(r, 500));
    console.log('[UI] Validation check (expected empty company name error):', (await page.evaluate(() => document.body.innerText)).includes('String must contain at least 1 character'));
    
    await page.type('#companyName', 'Final Verification Corp');
    await saveBtn.click();
    await new Promise(r => setTimeout(r, 1000));
    
    let textFinal = await page.evaluate(() => document.body.innerText);
    console.log('[UI] Form collapsed after save:', !textFinal.includes('Company Name *'));
    console.log('[UI] Application appears:', textFinal.includes('Final Verification Corp'));
    
    await page.reload({ waitUntil: 'networkidle2' });
    let textReload = await page.evaluate(() => document.body.innerText);
    console.log('[UI] Application remains after refresh:', textReload.includes('Final Verification Corp'));
  }
  
  await browser.close();
})();
