import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = '/home/adnan/.gemini/antigravity-cli/brain/4e93b471-3c85-4403-bed5-d29546fdf60c/mobile_audit';
const BASE_URL = 'http://localhost:5173/?subdomain=apex';

const VIEWPORTS = [
  { name: 'iPhone_14', width: 390, height: 844 },
  { name: 'Samsung_Galaxy_S21', width: 360, height: 800 }
];

const SCREENS = [
  { name: '01_Dashboard', hash: '#dashboard' },
  { name: '02_Students_Enrollment', hash: '#enrollment' },
  { name: '03_Academic_Classes', hash: '#classes' },
  { name: '04_Attendance_Desk', hash: '#attendance' },
  { name: '05_Fee_Receiving', hash: '#voucher' },
  { name: '06_Fee_Challans', hash: '#challans' },
  { name: '07_Income_Expenses', hash: '#expenses' },
  { name: '08_Exams_Desk', hash: '#exams' },
  { name: '09_Staff_Directory', hash: '#staff' },
  { name: '10_Staff_ClockIn', hash: '#geofence' },
  { name: '11_Timetable', hash: '#timetable' },
  { name: '12_Homework', hash: '#homework' },
  { name: '13_Settings', hash: '#settings' },
  { name: '14_Student_Portal', hash: '#student_portal' }
];

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true
  });

  const auditReport = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n==============================================`);
    console.log(`Auditing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`==============================================`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    });

    const page = await context.newPage();

    // Go to login page
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 20000 });
    await delay(1000);

    const loginId = await page.$('#login-identifier');
    if (loginId) {
      console.log('Logging in...');
      await page.fill('#login-identifier', 'adnan@apexacademy.edu.pk');
      await page.fill('#login-password', 'Admin@123');
      await page.click('#login-submit-btn');
      await page.waitForSelector('nav[data-testid="mobile-bottom-nav"]', { timeout: 15000 }).catch(() => {});
      await delay(2500);
      console.log('Logged in successfully!');
    }

    for (const scr of SCREENS) {
      console.log(`Navigating to ${scr.name} (${scr.hash})...`);
      // Update hash in SPA without full page teardown
      await page.evaluate((hash) => {
        window.location.hash = hash;
      }, scr.hash);
      await delay(1200);

      // Wait for content to render
      await page.waitForSelector('header', { timeout: 5000 }).catch(() => {});
      await delay(800);

      // Evaluate mobile metrics
      const metrics = await page.evaluate(() => {
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;
        const docWidth = document.documentElement.scrollWidth;
        const bodyWidth = document.body.scrollWidth;
        const hasOverflow = docWidth > winWidth + 1 || bodyWidth > winWidth + 1;

        // Find elements with horizontal scrollbars or overflowing containers ("sliders")
        const horizontalContainers = [];
        document.querySelectorAll('*').forEach(el => {
          const style = window.getComputedStyle(el);
          const isScroll = (style.overflowX === 'auto' || style.overflowX === 'scroll');
          if (isScroll && el.scrollWidth > el.clientWidth + 10) {
            horizontalContainers.push({
              tag: el.tagName.toLowerCase(),
              className: (el.className || '').toString().slice(0, 100),
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
              diff: el.scrollWidth - el.clientWidth,
              textSnippet: (el.textContent || '').trim().slice(0, 50)
            });
          }
        });

        // Find oversized typography (font size >= 22px on mobile)
        const bigFonts = [];
        document.querySelectorAll('h1, h2, h3, h4, span, div, p, button').forEach(el => {
          if (el.children.length > 1) return;
          const text = (el.textContent || '').trim();
          if (!text || text.length > 50) return;
          const style = window.getComputedStyle(el);
          const size = parseFloat(style.fontSize);
          if (size >= 22) {
            bigFonts.push({
              text: text.slice(0, 40),
              size: Math.round(size),
              tag: el.tagName.toLowerCase(),
              className: (el.className || '').toString().slice(0, 60)
            });
          }
        });

        // Find bulky cards with huge padding (p-6, p-8, padding >= 24px)
        const bulkyElements = [];
        document.querySelectorAll('div, section, main, card').forEach(el => {
          const style = window.getComputedStyle(el);
          const padLeft = parseFloat(style.paddingLeft);
          const padRight = parseFloat(style.paddingRight);
          const padTop = parseFloat(style.paddingTop);
          if (padLeft >= 24 && el.clientWidth < winWidth) {
            bulkyElements.push({
              tag: el.tagName.toLowerCase(),
              padding: `${padTop}px ${padRight}px ${padLeft}px`,
              className: (el.className || '').toString().slice(0, 60)
            });
          }
        });

        return {
          winWidth,
          docWidth,
          hasOverflow,
          horizontalContainersCount: horizontalContainers.length,
          horizontalContainers: horizontalContainers.slice(0, 5),
          bigFontsCount: bigFonts.length,
          bigFonts: bigFonts.slice(0, 6),
          bulkyCount: bulkyElements.length
        };
      });

      const ssName = `${vp.name}_${scr.name}.png`;
      const ssPath = path.join(ARTIFACTS_DIR, ssName);
      await page.screenshot({ path: ssPath, fullPage: false });

      console.log(`[${scr.name}] Overflow: ${metrics.hasOverflow ? '❌ YES (' + metrics.docWidth + 'px > ' + metrics.winWidth + 'px)' : '✅ NO'} | Horiz sliders: ${metrics.horizontalContainersCount} | Big fonts: ${metrics.bigFontsCount} | Bulky containers: ${metrics.bulkyCount}`);
      auditReport.push({
        viewport: vp.name,
        screen: scr.name,
        screenshot: ssName,
        metrics
      });
    }

    await context.close();
  }

  await browser.close();

  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'audit_summary.json'),
    JSON.stringify(auditReport, null, 2)
  );
  console.log('\nAudit complete! Saved to ' + path.join(ARTIFACTS_DIR, 'audit_summary.json'));
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
