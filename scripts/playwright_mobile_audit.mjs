import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = '/home/adnan/.gemini/antigravity-cli/brain/2e7e77d4-9929-4120-8f55-ca00be8aa857';
const BASE_URL = 'http://localhost:5173/?subdomain=apex';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Mobile Device Configuration (iPhone 14 standard mobile profile)
const MOBILE_DEVICE = {
  name: 'iPhone 14 / Pixel 7 Mobile Viewport',
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
};

async function runMobileAudit() {
  console.log('📱 =========================================================');
  console.log('📱 STARTING FULL PLAYWRIGHT MOBILE AUDIT & NATIVE VERIFICATION');
  console.log('📱 =========================================================\n');

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  // Launch Chromium using installed google-chrome or bundled playwright
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true
  });

  const context = await browser.newContext(MOBILE_DEVICE);
  const page = await context.newPage();

  const auditResults = {
    testedAt: new Date().toISOString(),
    device: MOBILE_DEVICE.name,
    viewport: MOBILE_DEVICE.viewport,
    checks: [],
    screenshots: []
  };

  function recordCheck(name, passed, details = '') {
    auditResults.checks.push({ name, passed, details });
    const symbol = passed ? '✅' : '❌';
    console.log(`${symbol} [${passed ? 'PASS' : 'FAIL'}] ${name}: ${details}`);
  }

  async function capture(filename, description) {
    const filePath = path.join(ARTIFACTS_DIR, filename);
    await page.screenshot({ path: filePath, fullPage: false });
    auditResults.screenshots.push({ filename, description, path: filePath });
    console.log(`📸 Saved screenshot: ${filename} (${description})`);
  }

  async function checkHorizontalOverflow(screenName) {
    const overflowInfo = await page.evaluate(() => {
      const windowWidth = window.innerWidth;
      const docWidth = document.documentElement.scrollWidth;
      const bodyWidth = document.body.scrollWidth;
      const hasOverflow = docWidth > windowWidth + 1 || bodyWidth > windowWidth + 1;

      let offendingElements = [];
      if (hasOverflow) {
        document.querySelectorAll('*').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > windowWidth + 2) {
            offendingElements.push({
              tag: el.tagName.toLowerCase(),
              className: el.className?.toString().slice(0, 50) || '',
              right: Math.round(rect.right),
              windowWidth
            });
          }
        });
      }

      return {
        windowWidth,
        docWidth,
        bodyWidth,
        hasOverflow,
        offendingCount: offendingElements.length,
        offendingElements: offendingElements.slice(0, 3)
      };
    });

    const passed = !overflowInfo.hasOverflow;
    recordCheck(
      `No Horizontal Overflow on "${screenName}"`,
      passed,
      passed 
        ? `Viewport ${overflowInfo.windowWidth}px matches docWidth ${overflowInfo.docWidth}px` 
        : `Overflow detected: docWidth=${overflowInfo.docWidth}px > viewport=${overflowInfo.windowWidth}px (${overflowInfo.offendingCount} offending elements)`
    );
    return passed;
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: LOGIN PAGE & SUBDOMAIN BRANDING
    // -------------------------------------------------------------
    console.log('\n--- Step 1: Mobile Login Screen & PWA Meta Verification ---');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await delay(1000);

    // Verify viewport meta tag
    const metaViewport = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="viewport"]');
      const manifest = document.querySelector('link[rel="manifest"]');
      const themeColor = document.querySelector('meta[name="theme-color"]');
      return {
        viewportContent: meta?.getAttribute('content') || '',
        manifestHref: manifest?.getAttribute('href') || '',
        themeColor: themeColor?.getAttribute('content') || ''
      };
    });

    recordCheck(
      'PWA Viewport-fit Meta Tag',
      metaViewport.viewportContent.includes('viewport-fit=cover'),
      metaViewport.viewportContent
    );
    recordCheck(
      'Web App Manifest Link',
      metaViewport.manifestHref === '/manifest.json',
      `Manifest linked: ${metaViewport.manifestHref}`
    );

    await checkHorizontalOverflow('Mobile Login Screen');
    await capture('01_mobile_subdomain_login.png', 'Subdomain Login Screen on iPhone 14');

    // Perform Login
    console.log('Logging in as adnan@apexacademy.edu.pk ...');
    await page.fill('#login-identifier', 'adnan@apexacademy.edu.pk');
    await page.fill('input[type="password"]', 'Admin@123');
    await page.click('button:has-text("Sign In")');
    await page.waitForSelector('nav[data-testid="mobile-bottom-nav"]', { timeout: 15000 });
    await delay(2000);

    // -------------------------------------------------------------
    // TEST 2: DIRECTOR DASHBOARD & MOBILE APP BAR
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Director Dashboard on Mobile ---');
    await checkHorizontalOverflow('Director Dashboard');
    await capture('02_mobile_director_dashboard.png', 'Director Dashboard Mobile High-Density View');

    // Verify Mobile Bottom Nav Presence
    const bottomNavStatus = await page.evaluate(() => {
      const nav = document.querySelector('nav[data-testid="mobile-bottom-nav"]');
      if (!nav) return { exists: false, isVisible: false };
      const style = window.getComputedStyle(nav);
      const rect = nav.getBoundingClientRect();
      return {
        exists: true,
        isVisible: style.display !== 'none' && style.visibility !== 'hidden',
        position: style.position,
        height: Math.round(rect.height),
        buttonsCount: nav.querySelectorAll('button').length
      };
    });

    recordCheck(
      'Fixed Mobile Bottom Navigation Bar',
      bottomNavStatus.exists && bottomNavStatus.isVisible && bottomNavStatus.position === 'fixed',
      `Bottom Nav visible with ${bottomNavStatus.buttonsCount} tab actions (height: ${bottomNavStatus.height}px)`
    );

    // -------------------------------------------------------------
    // TEST 3: MOBILE SIDEBAR DRAWER (OFF-CANVAS GESTURE DRAWER)
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Off-Canvas Navigation Drawer ---');
    const hamburger = await page.$('header button[aria-label="Open Navigation"]');
    if (hamburger) {
      await hamburger.click();
      await delay(600);

      const drawerState = await page.evaluate(() => {
        const drawer = document.querySelector('aside');
        const backdrop = document.querySelector('.fixed.inset-0.bg-slate-900\\/60');
        const rect = drawer ? drawer.getBoundingClientRect() : null;
        return {
          drawerVisible: rect ? rect.width > 0 && rect.left >= 0 : false,
          drawerWidth: rect ? Math.round(rect.width) : 0,
          backdropExists: Boolean(backdrop)
        };
      });

      recordCheck(
        'Slide-Out Mobile Drawer Opens',
        drawerState.drawerVisible,
        `Drawer opened with width ${drawerState.drawerWidth}px (Backdrop present: ${drawerState.backdropExists})`
      );

      await capture('03_mobile_navigation_drawer.png', 'Off-Canvas Slide-Out Navigation Drawer');

      // Close drawer by tapping close button
      const closeBtn = await page.$('aside button[aria-label="Close navigation"]');
      if (closeBtn) {
        await closeBtn.click();
        await delay(500);
      }
    }

    // Helper to switch screens via hash or bottom nav
    async function navigateTo(screenId) {
      console.log(`Navigating to #${screenId}...`);
      await page.evaluate((sid) => {
        window.location.hash = '#' + sid;
      }, screenId);
      await delay(2000);
    }

    // -------------------------------------------------------------
    // TEST 4: ACADEMIC STRUCTURE & BATCHES
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Academic Structure & Batches ---');
    await navigateTo('classes');
    await checkHorizontalOverflow('Classes & Batches');
    await capture('04_mobile_academic_structure.png', 'Classes, Streams and Batches Mobile View');

    // -------------------------------------------------------------
    // TEST 5: STUDENT DIRECTORY & ADMISSIONS
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Student Directory & Admissions ---');
    await navigateTo('enrollment');
    await checkHorizontalOverflow('Students Directory');
    await capture('05_mobile_students_directory.png', 'Student Directory Register Mobile View');

    // -------------------------------------------------------------
    // TEST 6: ATTENDANCE DAILY ROSTER
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Attendance Daily Roster ---');
    await navigateTo('attendance');
    await checkHorizontalOverflow('Daily Attendance Register');

    // Verify presence of Attendance Status Buttons
    const attendanceControls = await page.evaluate(() => {
      const statusButtons = Array.from(document.querySelectorAll('button')).filter(b => 
        ['present', 'absent', 'late', 'excused'].includes(b.textContent?.trim().toLowerCase())
      );
      return { count: statusButtons.length };
    });

    recordCheck(
      'Attendance Touch Status Buttons Available',
      attendanceControls.count > 0,
      `Found ${attendanceControls.count} attendance action triggers`
    );

    await capture('06_mobile_attendance_register.png', 'Daily Attendance Register Mobile View');

    // -------------------------------------------------------------
    // TEST 7: TIMETABLE DESK
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Timetable Desk ---');
    await navigateTo('timetable');
    await checkHorizontalOverflow('Timetable Desk');
    await capture('07_mobile_timetable.png', 'Academic Timetable Mobile View');

    // -------------------------------------------------------------
    // TEST 8: FEE LEDGER & CHALLANS
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Fee Ledger & Challans ---');
    await navigateTo('voucher');
    await checkHorizontalOverflow('Fee Ledger');
    await capture('08_mobile_fee_ledger.png', 'Fee Ledger & Challans Mobile View');

    // Test Cashier Tab
    const cashierTab = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const cashier = btns.find(b => b.textContent && b.textContent.toLowerCase().includes('cashier'));
      if (cashier) {
        cashier.click();
        return true;
      }
      return false;
    });

    if (cashierTab) {
      await delay(1200);
      await checkHorizontalOverflow('Fee Cashier Collection');
      await capture('09_mobile_cashier_modal.png', 'Fee Cashier Collection Drawer');
    }

    // -------------------------------------------------------------
    // TEST 9: ABSENTEE RETENTION DESK
    // -------------------------------------------------------------
    console.log('\n--- Step 9: Absentee Retention Desk ---');
    await navigateTo('absentee');
    await checkHorizontalOverflow('Absentee Retention Desk');
    await capture('10_mobile_absentee_retention.png', 'Absentee Retention & WhatsApp Dispatch');

    // -------------------------------------------------------------
    // TEST 10: STAFF ATTENDANCE & CLOCK-IN
    // -------------------------------------------------------------
    console.log('\n--- Step 10: Staff Attendance & Clock-In ---');
    await navigateTo('geofence');
    await checkHorizontalOverflow('Staff Attendance & Geofence');
    await capture('11_mobile_staff_attendance.png', 'Staff Geofence Clock-In Mobile View');

    // -------------------------------------------------------------
    // TEST 11: INCOME & EXPENSES DESK
    // -------------------------------------------------------------
    console.log('\n--- Step 11: Income & Expenses Desk ---');
    await navigateTo('expenses');
    await checkHorizontalOverflow('Income & Expenses Desk');
    await capture('12_mobile_income_expenses.png', 'Income & Expenses High-Density Mobile View');

    // -------------------------------------------------------------
    // TEST 12: PAYROLL DESK
    // -------------------------------------------------------------
    console.log('\n--- Step 12: Payroll Desk ---');
    await navigateTo('payroll');
    await checkHorizontalOverflow('Payroll Desk');
    await capture('13_mobile_payroll.png', 'Faculty & Staff Payroll Mobile View');

    // -------------------------------------------------------------
    // TEST 13: ACADEMY SETTINGS
    // -------------------------------------------------------------
    console.log('\n--- Step 13: Academy Settings ---');
    await navigateTo('settings');
    await checkHorizontalOverflow('Academy Settings');
    await capture('14_mobile_settings.png', 'Academy Institutional Settings Mobile View');

    // -------------------------------------------------------------
    // TEST 14: STUDENT & PARENT PORTAL PREVIEW
    // -------------------------------------------------------------
    console.log('\n--- Step 14: Student & Parent Portal Mobile View ---');
    await navigateTo('student_portal');
    await checkHorizontalOverflow('Student & Parent Portal');
    await capture('15_mobile_student_portal.png', 'Student & Parent Portal Mobile View');

    // -------------------------------------------------------------
    // TEST 15: TEACHER FACULTY PORTAL
    // -------------------------------------------------------------
    console.log('\n--- Step 15: Teacher Faculty Portal Mobile View ---');
    await navigateTo('teacher');
    await checkHorizontalOverflow('Teacher Faculty Portal');
    await capture('16_mobile_teacher_portal.png', 'Teacher Faculty Portal Mobile View');

    // -------------------------------------------------------------
    // TEST 16: COMMAND SEARCH PALETTE ON MOBILE
    // -------------------------------------------------------------
    console.log('\n--- Step 16: Command Palette Search Modal on Mobile ---');
    const searchBtn = await page.$('header button[aria-label="Search records"]');
    if (searchBtn) {
      await searchBtn.click();
      await delay(500);

      const commandPaletteDock = await page.evaluate(() => {
        const dialog = document.querySelector('.fixed.inset-0.z-\\[80\\]');
        const input = dialog ? dialog.querySelector('input') : null;
        const computed = input ? window.getComputedStyle(input) : null;
        return {
          isOpen: Boolean(dialog),
          inputFontSize: computed?.fontSize || ''
        };
      });

      recordCheck(
        'Command Palette Search Modal Opens',
        commandPaletteDock.isOpen,
        `Modal opened. Input font size: ${commandPaletteDock.inputFontSize}`
      );

      await capture('17_mobile_command_search.png', 'Command Search Modal on Mobile');

      // Close it with Escape
      await page.keyboard.press('Escape');
      await delay(400);
    }

    // -------------------------------------------------------------
    // INPUT FONT SIZE AUDIT (PREVENT IOS ZOOM)
    // -------------------------------------------------------------
    console.log('\n--- Step 17: iOS Input Font Size Audit (Preventing Auto-Zoom) ---');
    const inputFontAudit = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
      let sub16Count = 0;
      inputs.forEach(el => {
        const fs = parseFloat(window.getComputedStyle(el).fontSize);
        if (fs < 15.5) sub16Count++;
      });
      return { totalInputs: inputs.length, sub16Count };
    });

    recordCheck(
      'Input Font-Size >= 16px (Anti-iOS Zoom)',
      inputFontAudit.sub16Count === 0,
      `Audited ${inputFontAudit.totalInputs} inputs across screen, ${inputFontAudit.sub16Count} below 16px`
    );

  } catch (err) {
    console.error('Audit encountered an exception:', err);
    recordCheck('Audit Script Execution', false, err.message);
  } finally {
    await context.close();
    await browser.close();
  }

  // Summary Report
  console.log('\n📱 =========================================================');
  console.log('📱 MOBILE PLAYWRIGHT AUDIT COMPLETE - SUMMARY REPORT');
  console.log('📱 =========================================================');
  const passCount = auditResults.checks.filter(c => c.passed).length;
  const totalChecks = auditResults.checks.length;
  const score = Math.round((passCount / totalChecks) * 100);
  console.log(`Score: ${score}% (${passCount}/${totalChecks} Checks Passed)`);
  console.log(`Total Screenshots Captured: ${auditResults.screenshots.length}`);
  console.log('Artifacts Directory:', ARTIFACTS_DIR);

  // Write audit results JSON
  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'mobile_audit_report.json'),
    JSON.stringify(auditResults, null, 2)
  );
  console.log('Report saved to:', path.join(ARTIFACTS_DIR, 'mobile_audit_report.json'));

  return auditResults;
}

runMobileAudit();
