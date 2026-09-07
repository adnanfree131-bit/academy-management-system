import puppeteer from 'puppeteer-core';
import path from 'path';

async function runQA() {
  console.log('🚀 Starting Automated QA Suite for Apex Academy ERP...');
  
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--window-size=1280,800',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const consoleLogs = [];
  const pageErrors = [];

  page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => pageErrors.push(err.toString()));

  try {
    // 1. Visit Login Page
    console.log('👉 [1/6] Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });

    const title = await page.title();
    console.log(`   Page Title: "${title}"`);
    if (title !== 'Apex Academy ERP') throw new Error(`Unexpected page title: ${title}`);

    // Verify institutional branding
    const modalText = await page.$eval('body', el => el.innerText);
    if (!modalText.includes('Apex Academy ERP') || !modalText.includes('Multi-Tenant Institutional Operations Portal')) {
      throw new Error('Institutional login branding missing!');
    }
    console.log('   ✅ Institutional branding verified.');

    // 2. Perform 1-Click Dev Sign-In
    console.log('👉 [2/6] Triggering 1-Click Dev Sign-In (Director Adnan)...');
    const quickLoginBtn = await page.waitForSelector('button ::-p-text(1-Click Dev Sign-In)', { timeout: 5000 });
    if (!quickLoginBtn) throw new Error('1-Click Dev Sign-In button not found!');
    await quickLoginBtn.click();

    // 3. Wait for Authenticated Dashboard
    console.log('👉 [3/6] Waiting for Executive Dashboard...');
    await page.waitForSelector('h1 ::-p-text(Executive Academy Overview)', { timeout: 8000 });
    console.log('   ✅ Executive Academy Overview loaded.');

    // Verify Campus and Academic Session
    const headerText = await page.$eval('header', el => el.innerText);
    console.log(`   Header Info: "${headerText.replace(/\n+/g, ' ')}"`);
    if (!headerText.includes('Apex Academy') || !headerText.includes('Executive Dashboard')) {
      throw new Error('Header breadcrumb mismatch');
    }
    console.log('   ✅ Header & campus details verified.');

    // Capture Dashboard Screenshot
    await page.screenshot({ path: path.join(process.cwd(), 'qa_dashboard_verified.png'), fullPage: true });
    console.log('   📸 Screenshot saved: qa_dashboard_verified.png');

    // 4. Test Navigation Across All Locked Modules
    console.log('👉 [4/6] Verifying Sidebar Navigation & Screen Routing...');
    const modules = [
      { name: 'Student Attendance Desk', headerExpected: 'Student Attendance Desk' },
      { name: 'Absence Follow-Up', headerExpected: 'Absence Follow-Up & Retention Desk' },
      { name: 'Student Admissions & SIS', headerExpected: 'Student Admissions & SIS Desk' },
      { name: 'Fee Invoices & Vouchers', headerExpected: 'Fee Invoices & Vouchers' },
      { name: 'Staff Payroll & Salaries', headerExpected: 'Staff Payroll & Salaries' },
      { name: 'Mobile Web App (PWA)', headerExpected: 'Native Mobile Experience' },
      { name: 'Executive Dashboard', headerExpected: 'Executive Academy Overview' },
    ];

    for (const mod of modules) {
      const navBtn = await page.waitForSelector(`aside button ::-p-text(${mod.name})`);
      await navBtn.click();
      await page.waitForFunction(
        expected => document.body.innerText.includes(expected),
        { timeout: 4000 },
        mod.headerExpected
      );
      console.log(`   ✅ Navigated cleanly to: ${mod.name}`);
    }

    // 5. Test Mobile Responsive Drawer Viewport
    console.log('👉 [5/6] Testing Mobile Responsive Drawer (375x812 iPhone Viewport)...');
    await page.setViewport({ width: 375, height: 812 });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    
    // Hamburger button should now be visible
    const hamburgerBtn = await page.waitForSelector('header button:has(svg.lucide-menu)', { visible: true });
    await hamburgerBtn.click();
    console.log('   ✅ Opened mobile drawer via hamburger menu.');

    // Capture Mobile Drawer Screenshot
    await page.screenshot({ path: path.join(process.cwd(), 'qa_mobile_drawer_verified.png') });
    console.log('   📸 Screenshot saved: qa_mobile_drawer_verified.png');

    // Restore desktop viewport
    await page.setViewport({ width: 1280, height: 800 });

    // 6. Test Sign-Out
    console.log('👉 [6/6] Testing Sign-Out Flow...');
    const logoutBtn = await page.waitForSelector('aside button[title="Sign Out"]');
    await logoutBtn.click();
    await page.waitForSelector('button ::-p-text(1-Click Dev Sign-In)', { timeout: 5000 });
    console.log('   ✅ Signed out cleanly, returned to login modal.');

    // Console Error Audit
    console.log('\n🔍 --- BROWSER CONSOLE AUDIT ---');
    const severeErrors = pageErrors.concat(
      consoleLogs.filter(l => l.type === 'error').map(l => l.text)
    );

    if (severeErrors.length > 0) {
      console.error('❌ Browser Errors detected:', severeErrors);
      throw new Error(`QA failed with ${severeErrors.length} browser console errors.`);
    } else {
      console.log('✅ ZERO browser errors or unhandled exceptions detected!');
    }

    console.log('\n🎉 ALL QA AUDIT CHECKS PASSED (Score: 10/10)!');
  } finally {
    await browser.close();
  }
}

runQA().catch(err => {
  console.error('\n❌ QA Test Suite Failed:', err);
  process.exit(1);
});
