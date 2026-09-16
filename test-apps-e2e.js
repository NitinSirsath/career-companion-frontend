import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/applications', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  
  let text = await page.evaluate(() => document.body.innerText);
  console.log('[UI] Initial form visibility:', text.includes('Track New Application') ? 'VISIBLE' : 'HIDDEN');
  
  const addBtns = await page.$$('button');
  let addBtn = null;
  for (const btn of addBtns) {
    const btnText = await page.evaluate(el => el.textContent, btn);
    if (btnText.includes('+ Add Application')) {
      addBtn = btn; break;
    }
  }
  
  if (addBtn) {
    console.log('[Action] Clicking + Add Application');
    await addBtn.click();
    await new Promise(r => setTimeout(r, 500));
    
    let formText = await page.evaluate(() => document.body.innerText);
    console.log('[UI] Form visibility after click:', formText.includes('Track New Application') ? 'VISIBLE' : 'HIDDEN');
    
    const allBtns = await page.$$('button');
    let saveBtn = null;
    for (const btn of allBtns) {
      const btnText = await page.evaluate(el => el.textContent, btn);
      if (btnText.includes('Save Application')) {
        saveBtn = btn; break;
      }
    }
    
    if (saveBtn) {
      console.log('[Action] Clicking Save Application (empty)');
      await saveBtn.click();
      await new Promise(r => setTimeout(r, 500));
      let validationText = await page.evaluate(() => document.body.innerText);
      console.log('[UI] Validation message:', validationText.includes('String must contain at least 1 character') ? 'VISIBLE' : 'HIDDEN');
      
      await page.type('#companyName', 'Puppeteer Test Corp');
      await page.type('#jobTitle', 'E2E Tester');
      console.log('[Action] Filled form, submitting...');
      await saveBtn.click();
      await new Promise(r => setTimeout(r, 1000));
      
      let finalUI = await page.evaluate(() => document.body.innerText);
      console.log('[UI] Form closed:', !finalUI.includes('Track New Application') ? 'YES' : 'NO');
      console.log('[UI] New Application in list:', finalUI.includes('Puppeteer Test Corp') ? 'YES' : 'NO');
    }
  }
  
  await browser.close();
})();
