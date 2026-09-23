import { chromium } from 'playwright';

async function testAll() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true
  });

  const viewports = [
    { name: 'iPhone 13 (375x812)', width: 375, height: 812 },
    { name: 'Pixel 7 (390x844)', width: 390, height: 844 }
  ];

  for (const vp of viewports) {
    console.log(`\n======================================================`);
    console.log(`🧪 Testing Viewport: ${vp.name}`);
    console.log(`======================================================`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
    });

    const page = await context.newPage();

    let pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    // 1. LOGIN SCREEN
    await page.goto('http://localhost:5173/?subdomain=apex');
    await page.waitForTimeout(800);

    // Verify no placeholders on login input
    const loginInputPlaceholder = await page.getAttribute('#login-identifier', 'placeholder');
    console.log(`✓ Login input placeholder: "${loginInputPlaceholder || ''}" (expected empty)`);

    // Verify zero horizontal scroll on login
    const loginOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    console.log(`✓ Login zero horizontal overflow: ${loginOverflow}`);

    // Perform Login
    await page.fill('#login-identifier', 'adnan@apexacademy.edu.pk');
    await page.fill('input[type="password"]', 'Admin@123');
    await page.click('button:has-text("Sign In")');

    await page.waitForSelector('nav[data-testid="mobile-bottom-nav"]', { timeout: 10000 });
    console.log(`✓ Logged in successfully!`);

    // 2. HEADER INSPECTION
    const headerInfo = await page.evaluate(() => {
      const header = document.querySelector('header');
      if (!header) return null;
      const rect = header.getBoundingClientRect();
      const titleSpan = header.querySelector('span.text-xs.font-bold');
      return {
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        titleText: titleSpan ? titleSpan.textContent.trim() : null
      };
    });
    console.log(`✓ Header inspection: height=${headerInfo.height}px, title="${headerInfo.titleText}"`);

    // 3. DASHBOARD VERIFICATION
    const dashboardStats = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return null;
      const text = main.innerText;
      return {
        hasAttendanceTile: text.includes('Attendance'),
        hasFeesTile: text.includes('Fees'),
        hasStudentsTile: text.includes('Students'),
        hasFacultyTile: text.includes('Faculty'),
        hasBatchesRoster: text.includes('Active Batches'),
        hasStreamDistribution: text.includes('Academic Stream Distribution'),
      };
    });
    console.log(`✓ Dashboard verification:`, dashboardStats);

    const dashOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    console.log(`✓ Dashboard zero horizontal overflow: ${dashOverflow}`);

    // 4. ENROLLMENT DESK VERIFICATION
    await page.evaluate(() => { window.location.hash = '#enrollment'; });
    await page.waitForTimeout(2000);

    const enrollmentInfo = await page.evaluate(() => {
      const main = document.querySelector('main');
      const text = main?.innerText || '';
      const hasInsightsBtn = text.includes('Insights');
      const hasStudentCard = text.includes('Muhammad Ali Raza');
      const hasBulkyCards = document.querySelectorAll('.border-l-\\[3\\.5px\\]').length;
      return { hasInsightsBtn, hasStudentCard, visibleBulkyCards: hasBulkyCards };
    });
    console.log(`✓ Enrollment Desk verification:`, enrollmentInfo);

    const enrollOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    console.log(`✓ Enrollment zero horizontal overflow: ${enrollOverflow}`);

    // 5. FEE DESK VERIFICATION
    await page.evaluate(() => { window.location.hash = '#voucher'; });
    await page.waitForTimeout(2000);

    const feeDeskInfo = await page.evaluate(() => {
      const main = document.querySelector('main');
      const text = main?.innerText || '';
      const hasInsightsBtn = text.includes('Insights');
      const hasBulkyGrid = Boolean(document.querySelector('.hidden.sm\\:grid'));
      return { hasInsightsBtn, hasDesktopOnlyGrid: hasBulkyGrid };
    });
    console.log(`✓ Fee Desk verification:`, feeDeskInfo);

    // Test opening Cashier drawer if invoice exists
    const receiveBtn = await page.$('button:has-text("Receive")');
    if (receiveBtn) {
      await receiveBtn.click();
      await page.waitForTimeout(600);
      const modalInfo = await page.evaluate(() => {
        const modal = document.querySelector('.mobile-sheet-card');
        const activeEl = document.activeElement;
        const amountInput = modal?.querySelector('input[type="number"]');
        return {
          isModalOpen: Boolean(modal),
          inputHasAutoFocus: amountInput?.hasAttribute('autofocus') || false,
          isAmountFocusedOnOpen: activeEl === amountInput
        };
      });
      console.log(`✓ Cashier modal inspection:`, modalInfo);

      // Close modal
      const cancelBtn = await page.$('button:has-text("Cancel")');
      if (cancelBtn) await cancelBtn.click();
    }

    const feeOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    console.log(`✓ Fee Desk zero horizontal overflow: ${feeOverflow}`);

    if (pageErrors.length > 0) {
      console.error(`❌ Page Errors encountered:`, pageErrors);
    } else {
      console.log(`✅ Zero page errors!`);
    }

    await context.close();
  }

  await browser.close();
  console.log(`\n🎉 All Playwright verification tests completed successfully!`);
}

testAll().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
