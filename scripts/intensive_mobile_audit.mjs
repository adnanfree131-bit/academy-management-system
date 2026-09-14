import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = '/home/adnan/.gemini/antigravity-cli/brain/2e7e77d4-9929-4120-8f55-ca00be8aa857';
const BASE_URL = 'http://localhost:5173/?subdomain=apex';

const VIEWPORTS = [
  { name: 'iPhone 14 (390x844)', width: 390, height: 844 },
  { name: 'Android Galaxy (360x740)', width: 360, height: 740 },
  { name: 'Compact Mobile (320x658)', width: 320, height: 658 }
];

const SCREENS = [
  { name: 'Dashboard', hash: '#/' },
  { name: 'Enrollment', hash: '#/enrollment' },
  { name: 'Academic_Structure', hash: '#/academic' },
  { name: 'Attendance_Desk', hash: '#/attendance' },
  { name: 'Fee_Desk', hash: '#/fees' },
  { name: 'Cashbook_Expenses', hash: '#/expenses' },
  { name: 'Exam_Desk', hash: '#/exams' },
  { name: 'Staff_Desk', hash: '#/staff' },
  { name: 'Payroll_Desk', hash: '#/payroll' },
  { name: 'Absentee_Retention', hash: '#/absentee' },
  { name: 'Timetable_Desk', hash: '#/timetable' },
  { name: 'Homework_Desk', hash: '#/homework' },
  { name: 'Settings', hash: '#/settings' },
  { name: 'Student_Portal', hash: '#/student-portal' },
  { name: 'Complaints_Desk', hash: '#/complaints' }
];

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runIntensiveAudit() {
  console.log('🚀 ========================================================');
  console.log('🚀 INTENSIVE MOBILE RESPONSIVENESS & ERGONOMICS AUDIT');
  console.log('🚀 ========================================================\n');

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true
  });

  const fullReport = {
    timestamp: new Date().toISOString(),
    viewportsTested: VIEWPORTS.map(v => v.name),
    screenAudits: [],
    horizontalHurdles: [],
    oversizedFontElements: [],
    pageOverflows: []
  };

  for (const vp of VIEWPORTS) {
    console.log(`\n📱 --- TESTING VIEWPORT: ${vp.name} ---`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
    });
    const page = await context.newPage();

    // Login / Setup Auth
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await delay(1500);

    const loginIdentifier = await page.$('#login-identifier');
    if (loginIdentifier) {
      console.log('Authenticating with adnan@apexacademy.edu.pk ...');
      await page.fill('#login-identifier', 'adnan@apexacademy.edu.pk');
      await page.fill('input[type="password"]', 'Admin@123');
      await page.click('button:has-text("Sign In")');
      await page.waitForSelector('nav[data-testid="mobile-bottom-nav"]', { timeout: 15000 }).catch(() => {});
      await delay(2000);
    }

    for (const scr of SCREENS) {
      const targetUrl = `${BASE_URL}${scr.hash}`;
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 }).catch(async () => {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      });
      await delay(1200);

      // Audit Page for Horizontal Overflow, Horizontal Scroll Hurdles, and Oversized Typography
      const screenAudit = await page.evaluate((data) => {
        const { vpName, vpWidth, vpHeight, scrName } = data;
        const docWidth = document.documentElement.scrollWidth;
        const bodyWidth = document.body.scrollWidth;
        const winWidth = window.innerWidth;
        const hasPageOverflow = docWidth > winWidth + 1 || bodyWidth > winWidth + 1;

        // 1. Find Horizontal Scrolling Hurdles (elements with overflow-x scroll / auto where scrollWidth > clientWidth)
        const horizontalContainers = [];
        document.querySelectorAll('*').forEach(el => {
          const style = window.getComputedStyle(el);
          const isScrollableX = (style.overflowX === 'auto' || style.overflowX === 'scroll') && (el.scrollWidth > el.clientWidth + 5);
          if (isScrollableX) {
            horizontalContainers.push({
              tag: el.tagName.toLowerCase(),
              className: (el.className || '').toString().slice(0, 80),
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
              overflowAmount: el.scrollWidth - el.clientWidth,
              hasNoScrollbar: (el.className || '').includes('no-scrollbar'),
              textSnippet: (el.textContent || '').trim().slice(0, 40)
            });
          }
        });

        // 2. Find Oversized Fonts (computed fontSize >= 22px on mobile viewports)
        const oversizedFonts = [];
        document.querySelectorAll('h1, h2, h3, h4, p, span, div, button').forEach(el => {
          // Only check elements with direct text
          if (el.children.length > 2) return;
          const text = (el.textContent || '').trim();
          if (!text || text.length > 50) return;

          const style = window.getComputedStyle(el);
          const fontSize = parseFloat(style.fontSize);
          const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.2;

          if (fontSize >= 22) {
            oversizedFonts.push({
              tag: el.tagName.toLowerCase(),
              className: (el.className || '').toString().slice(0, 70),
              fontSize: Math.round(fontSize),
              lineHeight: Math.round(lineHeight),
              text: text.slice(0, 35)
            });
          }
        });

        // 3. Find Outflow elements (bounding box leaking outside viewport)
        const leakingElements = [];
        document.querySelectorAll('*').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > winWidth + 2 && rect.width > 0 && rect.height > 0) {
            leakingElements.push({
              tag: el.tagName.toLowerCase(),
              className: (el.className || '').toString().slice(0, 70),
              right: Math.round(rect.right),
              width: Math.round(rect.width)
            });
          }
        });

        return {
          viewport: vpName,
          screen: scrName,
          hasPageOverflow,
          winWidth,
          docWidth,
          bodyWidth,
          horizontalCount: horizontalContainers.length,
          horizontalContainers: horizontalContainers.slice(0, 10),
          oversizedCount: oversizedFonts.length,
          oversizedFonts: oversizedFonts.slice(0, 10),
          leakingCount: leakingElements.length,
          leakingElements: leakingElements.slice(0, 5)
        };
      }, { vpName: vp.name, vpWidth: vp.width, vpHeight: vp.height, scrName: scr.name });

      // Save screenshot for primary viewport
      if (vp.width === 390) {
        const ssPath = path.join(ARTIFACTS_DIR, `audit_${scr.name}_390.png`);
        await page.screenshot({ path: ssPath, fullPage: false });
      }

      fullReport.screenAudits.push(screenAudit);
      if (screenAudit.hasPageOverflow) {
        fullReport.pageOverflows.push({ screen: scr.name, viewport: vp.name, docWidth: screenAudit.docWidth, winWidth: screenAudit.winWidth });
        console.log(`❌ [OVERFLOW] ${scr.name} on ${vp.name}: doc=${screenAudit.docWidth}px vs win=${screenAudit.winWidth}px`);
      } else {
        console.log(`✅ [NO OVERFLOW] ${scr.name} on ${vp.name} (Hurdles: ${screenAudit.horizontalCount}, Oversized: ${screenAudit.oversizedCount})`);
      }
    }

    await context.close();
  }

  await browser.close();

  const reportPath = path.join(ARTIFACTS_DIR, 'intensive_mobile_audit_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2));
  console.log(`\n📋 Audit completed! Report saved to: ${reportPath}`);
}

runIntensiveAudit().catch(err => {
  console.error('Audit Error:', err);
  process.exit(1);
});
