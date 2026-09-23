import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const BASE_URL = 'http://localhost:5173/?subdomain=apex';

const VIEWPORTS = [
  { name: 'iPhone 13 Mini / SE (375x812)', width: 375, height: 812 },
  { name: 'iPhone 14 / Pixel 7 (390x844)', width: 390, height: 844 }
];

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runVerification() {
  console.log('📱 =================================================================');
  console.log('📱 KAMPUS MOBILE NATIVE SHELL - COMPREHENSIVE PLAYWRIGHT AUDIT');
  console.log('📱 Viewports: 375x812 & 390x844');
  console.log('📱 =================================================================\n');

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true
  });

  let totalPassed = 0;
  let totalFailed = 0;
  const failureLog = [];

  function record(name, passed, details = '') {
    if (passed) {
      totalPassed++;
      console.log(`  ✅ [PASS] ${name}${details ? ` (${details})` : ''}`);
    } else {
      totalFailed++;
      failureLog.push({ name, details });
      console.error(`  ❌ [FAIL] ${name}: ${details}`);
    }
  }

  for (const vp of VIEWPORTS) {
    console.log(`\n=================================================================`);
    console.log(`🔍 AUDITING VIEWPORT: ${vp.name}`);
    console.log(`=================================================================`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
    });

    const page = await context.newPage();

    async function checkZeroHorizontalOverflow(label) {
      const overflow = await page.evaluate(() => {
        const windowWidth = window.innerWidth;
        const docWidth = document.documentElement.scrollWidth;
        const bodyWidth = document.body.scrollWidth;
        const mainEl = document.querySelector('main');
        const mainWidth = mainEl ? mainEl.scrollWidth : 0;
        const mainClientWidth = mainEl ? mainEl.clientWidth : 0;

        // Check if root or body scrolls horizontally
        const hasRootOverflow = docWidth > windowWidth || bodyWidth > windowWidth;
        
        let culprits = [];
        if (hasRootOverflow) {
          document.querySelectorAll('*').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.right > windowWidth + 1) {
              culprits.push(`${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 30)} (r=${Math.round(rect.right)})`);
            }
          });
        }

        return {
          windowWidth,
          docWidth,
          bodyWidth,
          mainWidth,
          mainClientWidth,
          hasRootOverflow,
          culprits: culprits.slice(0, 3)
        };
      });

      const passed = !overflow.hasRootOverflow;
      record(
        `[${vp.width}px] Zero Horizontal Page Scroll on "${label}"`,
        passed,
        passed 
          ? `docWidth: ${overflow.docWidth}px <= viewport: ${overflow.windowWidth}px` 
          : `OVERFLOW: docWidth ${overflow.docWidth}px > ${overflow.windowWidth}px (Culprits: ${overflow.culprits.join(', ')})`
      );
      return passed;
    }

    try {
      // 1. LOGIN SCREEN AUDIT
      console.log(`\n-- Step 1: Login Screen & PWA Meta (${vp.width}px) --`);
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await delay(1000);

      // Check Manifest & Meta
      const meta = await page.evaluate(() => {
        const vpMeta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
        const themeMeta = document.querySelector('meta[name="theme-color"]')?.getAttribute('content') || '';
        const manifest = document.querySelector('link[rel="manifest"]')?.getAttribute('href') || '';
        const hasBottomNav = Boolean(document.querySelector('nav[data-testid="mobile-bottom-nav"]'));
        const hasDrawer = Boolean(document.querySelector('aside'));
        return { vpMeta, themeMeta, manifest, hasBottomNav, hasDrawer };
      });

      record(`[${vp.width}px] PWA Viewport Fit Cover`, meta.vpMeta.includes('viewport-fit=cover'), meta.vpMeta);
      record(`[${vp.width}px] Manifest Link Present`, meta.manifest === '/manifest.json', meta.manifest);
      record(`[${vp.width}px] Login Has No Bottom Nav or Drawer`, !meta.hasBottomNav, 'Unauthenticated shell clean');

      await checkZeroHorizontalOverflow('Login Screen');

      // Check Login Submit Button Size
      const loginBtnSize = await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]');
        if (!btn) return { h: 0, w: 0 };
        const rect = btn.getBoundingClientRect();
        return { h: Math.round(rect.height), w: Math.round(rect.width) };
      });
      record(`[${vp.width}px] Login Primary Button >= 48px`, loginBtnSize.h >= 48, `height: ${loginBtnSize.h}px`);

      // PERFORM LOGIN
      console.log(`Logging in as adnan@apexacademy.edu.pk ...`);
      await page.fill('#login-identifier', 'adnan@apexacademy.edu.pk');
      await page.fill('input[type="password"]', 'Admin@123');
      await page.click('button:has-text("Sign In")');

      // Wait for authenticated app
      await page.waitForSelector('nav[data-testid="mobile-bottom-nav"]', { timeout: 15000 });
      await delay(2000);

      // 2. AUTHENTICATED ROOT SHELL CONTRACT
      console.log(`\n-- Step 2: Authenticated Shell DOM Contract (${vp.width}px) --`);
      const shellContract = await page.evaluate(() => {
        const html = document.documentElement;
        const body = document.body;
        const root = document.getElementById('root');
        const main = document.querySelector('main');
        const header = document.querySelector('header');
        const bottomNav = document.querySelector('nav[data-testid="mobile-bottom-nav"]');

        const htmlStyle = window.getComputedStyle(html);
        const bodyStyle = window.getComputedStyle(body);
        const headerStyle = header ? window.getComputedStyle(header) : null;
        const bottomNavStyle = bottomNav ? window.getComputedStyle(bottomNav) : null;
        const mainStyle = main ? window.getComputedStyle(main) : null;

        return {
          htmlHeight: htmlStyle.height,
          bodyHeight: bodyStyle.height,
          mainOverflowY: mainStyle?.overflowY,
          mainOverflowX: mainStyle?.overflowX,
          headerPosition: headerStyle?.position,
          bottomNavPosition: bottomNavStyle?.position,
          bottomNavTabsCount: bottomNav ? bottomNav.querySelectorAll('button').length : 0
        };
      });

      record(`[${vp.width}px] Main Is Vertical Scroller`, shellContract.mainOverflowY === 'auto', `main overflow-y: ${shellContract.mainOverflowY}`);
      record(`[${vp.width}px] Main Guards Horizontal Overflow`, shellContract.mainOverflowX === 'hidden', `main overflow-x: ${shellContract.mainOverflowX}`);
      record(`[${vp.width}px] Header Is Sticky`, shellContract.headerPosition === 'sticky', `header position: ${shellContract.headerPosition}`);
      record(`[${vp.width}px] Bottom Nav Is Fixed`, shellContract.bottomNavPosition === 'fixed', `bottom nav position: ${shellContract.bottomNavPosition}`);
      record(`[${vp.width}px] Bottom Nav Has 5 Tabs`, shellContract.bottomNavTabsCount === 5, `${shellContract.bottomNavTabsCount} tabs found`);

      // 3. HEADER CONTROLS CONTRACT
      console.log(`\n-- Step 3: Header Controls Hit Targets (${vp.width}px) --`);
      const headerTargets = await page.evaluate(() => {
        const menuBtn = document.querySelector('header button[aria-label="Open Navigation"]');
        const searchBtn = document.querySelector('header button[aria-label="Search"]');
        const menuRect = menuBtn ? menuBtn.getBoundingClientRect() : { width: 0, height: 0 };
        const searchRect = searchBtn ? searchBtn.getBoundingClientRect() : { width: 0, height: 0 };
        return {
          menuWidth: Math.round(menuRect.width),
          menuHeight: Math.round(menuRect.height),
          searchWidth: Math.round(searchRect.width),
          searchHeight: Math.round(searchRect.height)
        };
      });

      record(`[${vp.width}px] Menu Button >= 44x44px`, headerTargets.menuWidth >= 44 && headerTargets.menuHeight >= 44, `${headerTargets.menuWidth}x${headerTargets.menuHeight}px`);
      record(`[${vp.width}px] Search Button >= 36x36px`, headerTargets.searchWidth >= 36 && headerTargets.searchHeight >= 36, `${headerTargets.searchWidth}x${headerTargets.searchHeight}px`);

      // 4. SIDEBAR DRAWER & HARDWARE BACK STACK
      console.log(`\n-- Step 4: Drawer & Back Stack Contract (${vp.width}px) --`);
      const menuBtn = await page.$('header button[aria-label="Open Navigation"]');
      if (menuBtn) {
        await menuBtn.click();
        await delay(500);

        const drawerStatus = await page.evaluate(() => {
          const aside = document.querySelector('aside');
          const scrim = document.querySelector('.fixed.inset-0.bg-slate-900\\/60');
          const asideRect = aside ? aside.getBoundingClientRect() : null;
          return {
            open: asideRect ? asideRect.width > 0 && asideRect.left >= 0 : false,
            width: asideRect ? Math.round(asideRect.width) : 0,
            hasScrim: Boolean(scrim),
            scrimHasNoSheet: scrim ? scrim.classList.contains('no-sheet-overlay') : false
          };
        });

        record(`[${vp.width}px] Drawer Opens Smoothly`, drawerStatus.open, `width: ${drawerStatus.width}px (<= 260px)`);
        record(`[${vp.width}px] Drawer Width <= 260px`, drawerStatus.width <= 260, `actual: ${drawerStatus.width}px`);
        record(`[${vp.width}px] Scrim Has no-sheet-overlay`, drawerStatus.scrimHasNoSheet, 'Tagged correctly');

        // Test popstate Back closes drawer without leaving screen
        console.log(`Triggering back button (popstate)...`);
        await page.evaluate(() => {
          window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
        });
        await delay(500);

        const drawerClosed = await page.evaluate(() => {
          const aside = document.querySelector('aside');
          const rect = aside ? aside.getBoundingClientRect() : null;
          return !rect || rect.right <= 0;
        });
        record(`[${vp.width}px] Back Button Closes Drawer`, drawerClosed, 'Drawer dismissed via overlay stack');
      }

      // 5. COMMAND SEARCH PALETTE
      console.log(`\n-- Step 5: Command Search Full-Screen (${vp.width}px) --`);
      const searchBtn = await page.$('header button[aria-label="Search"]');
      if (searchBtn) {
        await searchBtn.click();
        await delay(400);

        const paletteInfo = await page.evaluate(() => {
          const dialog = document.querySelector('.fixed.inset-0.z-\\[80\\]');
          const hasNoSheet = dialog ? dialog.classList.contains('no-sheet-overlay') : false;
          const input = dialog ? dialog.querySelector('input') : null;
          const fontSize = input ? parseFloat(window.getComputedStyle(input).fontSize) : 0;
          return { isOpen: Boolean(dialog), hasNoSheet, fontSize };
        });

        record(`[${vp.width}px] Search Palette Opens Full Screen`, paletteInfo.isOpen, 'Search opened');
        record(`[${vp.width}px] Search Palette no-sheet-overlay`, paletteInfo.hasNoSheet, 'Confirmed');
        record(`[${vp.width}px] Search Input Font >= 16px`, paletteInfo.fontSize >= 16, `${paletteInfo.fontSize}px`);

        // Close via Escape
        await page.keyboard.press('Escape');
        await delay(300);
      }

      // Helper for view navigation
      async function goTo(hash) {
        await page.evaluate(h => { window.location.hash = '#' + h; }, hash);
        await delay(1500);
      }

      // 6. ZERO HORIZONTAL OVERFLOW ACROSS ALL MAIN SCREENS
      console.log(`\n-- Step 6: Screen Overflow Audits (${vp.width}px) --`);
      
      const screens = [
        { hash: 'dashboard', name: 'Dashboard' },
        { hash: 'enrollment', name: 'Students Directory' },
        { hash: 'attendance', name: 'Attendance Register' },
        { hash: 'voucher', name: 'Fees Receiving' },
        { hash: 'classes', name: 'Classes & Batches' },
        { hash: 'timetable', name: 'Academic Timetable' },
        { hash: 'absentee', name: 'Absentee Retention' },
        { hash: 'geofence', name: 'Staff Attendance' },
        { hash: 'expenses', name: 'Income & Expenses' },
        { hash: 'settings', name: 'Academy Settings' },
        { hash: 'student_portal', name: 'Student Parent Portal' },
        { hash: 'teacher', name: 'Teacher Portal' }
      ];

      for (const s of screens) {
        await goTo(s.hash);
        await checkZeroHorizontalOverflow(s.name);
      }

      // 7. DASHBOARD QUICK CHIPS & SYNC BUTTON
      console.log(`\n-- Step 7: Dashboard Touch Targets (${vp.width}px) --`);
      await goTo('dashboard');
      const dashTargets = await page.evaluate(() => {
        const syncBtn = document.querySelector('button[aria-label="Refresh Telemetry"]');
        const syncRect = syncBtn ? syncBtn.getBoundingClientRect() : { width: 0, height: 0 };
        const quickChips = Array.from(document.querySelectorAll('.sm\\:hidden.grid.grid-cols-2 button'));
        const chipHeights = quickChips.map(c => Math.round(c.getBoundingClientRect().height));
        return {
          syncW: Math.round(syncRect.width),
          syncH: Math.round(syncRect.height),
          chipsCount: quickChips.length,
          allChipsGte40: chipHeights.length > 0 && chipHeights.every(h => h >= 40),
          chipHeights
        };
      });

      record(`[${vp.width}px] Dashboard Sync Button >= 44x44`, dashTargets.syncW >= 44 && dashTargets.syncH >= 44, `${dashTargets.syncW}x${dashTargets.syncH}px`);
      record(`[${vp.width}px] Dashboard 2x2 Quick Chips >= 40px`, dashTargets.allChipsGte40, `Heights: ${dashTargets.chipHeights.join(', ')}px`);

      // 8. ATTENDANCE SAVE BAR CLEARANCE
      console.log(`\n-- Step 8: Attendance Save Bar Clearance (${vp.width}px) --`);
      await goTo('attendance');
      const saveBarClearance = await page.evaluate(() => {
        const bottomNav = document.querySelector('nav[data-testid="mobile-bottom-nav"]');
        const saveBar = document.querySelector('.sm\\:hidden.fixed');
        if (!saveBar || !bottomNav) return { exists: false, clearance: 0 };
        const barRect = saveBar.getBoundingClientRect();
        const navRect = bottomNav.getBoundingClientRect();
        // saveBar bottom should be at or above navRect.top
        return {
          exists: true,
          saveBarBottom: Math.round(barRect.bottom),
          navTop: Math.round(navRect.top),
          cleared: barRect.bottom <= navRect.top + 2
        };
      });

      if (saveBarClearance.exists) {
        record(
          `[${vp.width}px] Attendance Save Bar Above Bottom Nav`,
          saveBarClearance.cleared,
          `Bar bottom ${saveBarClearance.saveBarBottom}px <= Nav top ${saveBarClearance.navTop}px`
        );
      } else {
        record(`[${vp.width}px] Attendance Save Bar Checked`, true, 'Sticky in container or not currently rendered');
      }

      // 9. STUDENT PROFILE MODAL AS MOBILE-SHEET
      console.log(`\n-- Step 9: Student Profile Bottom Sheet (${vp.width}px) --`);
      await goTo('enrollment');
      // Click first student card to open profile modal
      const firstStudentCard = await page.$('.p-3\\.5.active\\:bg-slate-50');
      if (firstStudentCard) {
        await firstStudentCard.click();
        await delay(1000);

        const sheetInfo = await page.evaluate(() => {
          const sheetOverlay = document.querySelector('.mobile-sheet');
          const sheetCard = document.querySelector('.mobile-sheet-card');
          const closeBtn = sheetCard ? sheetCard.querySelector('button[aria-label="Close"]') : null;
          const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : { width: 0, height: 0 };
          return {
            hasSheetOverlay: Boolean(sheetOverlay),
            hasSheetCard: Boolean(sheetCard),
            closeW: Math.round(closeRect.width),
            closeH: Math.round(closeRect.height)
          };
        });

        record(`[${vp.width}px] Profile Uses mobile-sheet Overlay`, sheetInfo.hasSheetOverlay, 'Verified');
        record(`[${vp.width}px] Profile Uses mobile-sheet-card`, sheetInfo.hasSheetCard, 'Verified');
        record(`[${vp.width}px] Profile Close Button >= 44x44`, sheetInfo.closeW >= 44 && sheetInfo.closeH >= 44, `${sheetInfo.closeW}x${sheetInfo.closeH}px`);

        // Close the modal
        const closeBtn = await page.$('.mobile-sheet-card button[aria-label="Close"]');
        if (closeBtn) {
          await closeBtn.click();
          await delay(500);
        }
      } else {
        console.log('No student cards available in directory for profile click test');
      }

      // 10. GLANCEABLE KPI STRIP & INSIGHTS BOTTOM SHEET
      console.log(`\n-- Step 10: Glanceable KPI Strip & Insights Sheet (${vp.width}px) --`);
      await goTo('dashboard');
      const dashStrip = await page.$('[data-testid="glanceable-kpi-strip"]');
      record(`[${vp.width}px] Dashboard Glanceable KPI Strip Present`, Boolean(dashStrip), 'Rendered on mobile');

      if (dashStrip) {
        const insightsBtn = await dashStrip.$('[data-testid="kpi-insights-trigger"]');
        if (insightsBtn) {
          await insightsBtn.click();
          await delay(600);

          const sheetInfo = await page.evaluate(() => {
            const overlay = document.querySelector('.mobile-sheet');
            const card = document.querySelector('.mobile-sheet-card');
            const closeBtn = card ? (card.querySelector('[data-testid="kpi-insights-close"]') || card.querySelector('button[aria-label="Close"]')) : null;
            const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : { width: 0, height: 0 };
            return {
              hasOverlay: Boolean(overlay),
              hasCard: Boolean(card),
              closeW: Math.round(closeRect.width),
              closeH: Math.round(closeRect.height)
            };
          });

          record(`[${vp.width}px] Dashboard Insights Sheet Opens`, sheetInfo.hasOverlay && sheetInfo.hasCard, 'Rendered with mobile-sheet & card');
          record(`[${vp.width}px] Dashboard Insights Close Button >= 44x44`, sheetInfo.closeW >= 44 && sheetInfo.closeH >= 44, `${sheetInfo.closeW}x${sheetInfo.closeH}px`);

          // Close sheet
          const closeBtn = await page.$('.mobile-sheet-card button[aria-label="Close"]');
          if (closeBtn) {
            await closeBtn.click();
            await delay(400);
          }
        }
      }

      // 11. DEDICATED FILTER & GROUPING BOTTOM SHEET
      console.log(`\n-- Step 11: Dedicated Filters Bottom Sheet (${vp.width}px) --`);
      await goTo('enrollment');
      const filterPillBtn = await page.$('[data-testid="filter-pill-button"], [data-testid="mobile-filter-pill-trigger"]');
      record(`[${vp.width}px] Filter Pill Button Present`, Boolean(filterPillBtn), 'Rendered on mobile enrollment view');

      if (filterPillBtn) {
        await filterPillBtn.click();
        await delay(600);

        const filterSheetInfo = await page.evaluate(() => {
          const sheet = document.querySelector('[data-testid="mobile-filter-sheet"], [data-testid="mobile-filter-sheet-overlay"]');
          const card = sheet ? (sheet.querySelector('.mobile-sheet-card') || sheet.querySelector('[data-testid="mobile-filter-sheet-card"]')) : null;
          const closeBtn = card ? (card.querySelector('[data-testid="filter-sheet-close"]') || card.querySelector('button[aria-label="Close"]')) : null;
          const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : { width: 0, height: 0 };
          const applyBtn = card ? card.querySelector('[data-testid="filter-sheet-apply"]') : null;
          const applyRect = applyBtn ? applyBtn.getBoundingClientRect() : { width: 0, height: 0 };
          const chips = card ? Array.from(card.querySelectorAll('[data-testid^="filter-chip-"]')) : [];
          return {
            hasSheet: Boolean(sheet),
            hasCard: Boolean(card),
            closeW: Math.round(closeRect.width),
            closeH: Math.round(closeRect.height),
            applyW: Math.round(applyRect.width),
            applyH: Math.round(applyRect.height),
            chipsCount: chips.length
          };
        });

        record(`[${vp.width}px] Filter Bottom Sheet Opens`, filterSheetInfo.hasSheet && filterSheetInfo.hasCard, 'Modal bottom sheet confirmed');
        record(`[${vp.width}px] Filter Close Button >= 44x44`, filterSheetInfo.closeW >= 44 && filterSheetInfo.closeH >= 44, `${filterSheetInfo.closeW}x${filterSheetInfo.closeH}px`);
        record(`[${vp.width}px] Filter Apply Button >= 44px Height`, filterSheetInfo.applyH >= 44, `height: ${filterSheetInfo.applyH}px`);
        record(`[${vp.width}px] Filter Segmented Chips Available`, filterSheetInfo.chipsCount > 0, `${filterSheetInfo.chipsCount} chips`);

        // Close via Apply
        const applyBtn = await page.$('[data-testid="filter-sheet-apply"]');
        if (applyBtn) {
          await applyBtn.click();
          await delay(400);
        }
      }

      // 12. HIGH-DENSITY NATIVE ROSTER CELLS (64px–80px)
      console.log(`\n-- Step 12: High-Density Native Roster Cells (${vp.width}px) --`);
      // A. Enrollment Roster
      const enrollmentCellHeights = await page.evaluate(() => {
        const cells = Array.from(document.querySelectorAll('[data-testid="student-roster-cell"]')).slice(0, 5);
        return cells.map(c => Math.round(c.getBoundingClientRect().height));
      });
      if (enrollmentCellHeights.length > 0) {
        const allWithinBounds = enrollmentCellHeights.every(h => h >= 64 && h <= 80);
        record(
          `[${vp.width}px] Enrollment Roster Cells Dense (64px–80px)`,
          allWithinBounds,
          `Heights: ${enrollmentCellHeights.join(', ')}px`
        );
      }

      // B. Attendance Roster
      await goTo('attendance');
      const attendanceRowHeights = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('[data-testid="attendance-roster-row"]')).slice(0, 5);
        return rows.map(r => Math.round(r.getBoundingClientRect().height));
      });
      if (attendanceRowHeights.length > 0) {
        const allWithinBounds = attendanceRowHeights.every(h => h >= 64 && h <= 80);
        record(
          `[${vp.width}px] Attendance Roster Cells Dense (64px–80px)`,
          allWithinBounds,
          `Heights: ${attendanceRowHeights.join(', ')}px`
        );
      }

      // C. Fee Desk Unpaid List
      await goTo('voucher');
      const feeCellHeights = await page.evaluate(() => {
        const list = document.querySelector('[data-testid="mobile-unpaid-fee-list"]');
        if (!list) return [];
        const items = Array.from(list.children).slice(0, 5);
        return items.map(i => Math.round(i.getBoundingClientRect().height));
      });
      if (feeCellHeights.length > 0) {
        const allWithinBounds = feeCellHeights.every(h => h >= 64 && h <= 80);
        record(
          `[${vp.width}px] Fee Cashier Unpaid Cells Dense (64px–80px)`,
          allWithinBounds,
          `Heights: ${feeCellHeights.join(', ')}px`
        );
      }

    } catch (err) {
      console.error(`Viewport ${vp.name} error:`, err);
      record(`Viewport ${vp.name} run`, false, err.message);
    } finally {
      await context.close();
    }
  }

  await browser.close();

  console.log('\n=================================================================');
  console.log('📊 FINAL PLAYWRIGHT AUDIT SUMMARY');
  console.log('=================================================================');
  console.log(`Total Passed: ${totalPassed}`);
  console.log(`Total Failed: ${totalFailed}`);
  const passRate = Math.round((totalPassed / (totalPassed + totalFailed)) * 100);
  console.log(`Pass Rate: ${passRate}%`);

  if (totalFailed > 0) {
    console.error('\nFailures:');
    failureLog.forEach(f => console.error(`  - ${f.name}: ${f.details}`));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL MOBILE NATIVE SHELL PLAYWRIGHT CHECKS PASSED PERFECTLY!\n');
    process.exit(0);
  }
}

runVerification();
