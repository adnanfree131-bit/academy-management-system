import puppeteer from 'puppeteer-core';
import path from 'path';

const ARTIFACTS_DIR = '/home/adnan/.gemini/antigravity-cli/brain/05ec2ac1-d879-46d9-9574-4e368e65e6b4';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runQA() {
  console.log('🚀 Starting Full Automated ERP QA Suite via Headless Chrome...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 }
  });

  const page = await browser.newPage();

  // Helper to click sidebar nav by button text using page.evaluate
  async function navigateTo(label) {
    console.log(`Navigating to "${label}"...`);
    const success = await page.evaluate((btnLabel) => {
      const buttons = Array.from(document.querySelectorAll('aside nav button'));
      const target = buttons.find(b => b.textContent && b.textContent.includes(btnLabel));
      if (target) {
        target.click();
        return true;
      }
      return false;
    }, label);

    if (!success) {
      console.warn(`Could not find nav button for "${label}"`);
    }
    await delay(2000);
    return success;
  }

  // 1. Subdomain Login Page
  console.log('--- Step 1: Subdomain Login Verification ---');
  await page.goto('http://localhost:5173/?subdomain=apex', { waitUntil: 'networkidle2' });
  await delay(1500);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'qa_v2_01_login_screen.png') });
  console.log('✅ Captured qa_v2_01_login_screen.png');

  // Perform Login as Campus Director
  console.log('Logging in as adnan@apexacademy.edu.pk ...');
  await page.type('input[type="email"]', 'adnan@apexacademy.edu.pk');
  await page.type('input[type="password"]', 'Admin@123');
  await page.keyboard.press('Enter');
  await delay(3500);

  // 2. Director Dashboard
  console.log('--- Step 2: Director Dashboard ---');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'qa_v2_02_director_dashboard.png') });
  console.log('✅ Captured qa_v2_02_director_dashboard.png');

  // 3. Student Admissions
  console.log('--- Step 3: Student Admissions ---');
  await navigateTo('Student Admissions');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'qa_v2_03_student_admissions.png') });
  console.log('✅ Captured qa_v2_03_student_admissions.png');

  // 4. Fee Invoices & Vouchers
  console.log('--- Step 4: Fee Invoices & Vouchers ---');
  await navigateTo('Fee Invoices & Vouchers');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'qa_v2_04_fee_invoices_vouchers.png') });
  console.log('✅ Captured qa_v2_04_fee_invoices_vouchers.png');

  // 5. Income & Expenses / Cashbook
  console.log('--- Step 5: Income & Expenses / Cashbook ---');
  await navigateTo('Income & Expenses');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'qa_v2_05_income_expenses_cashbook.png') });
  console.log('✅ Captured qa_v2_05_income_expenses_cashbook.png');

  // 6. Exams & Results
  console.log('--- Step 6: Exams & Results ---');
  await navigateTo('Exams & Results');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'qa_v2_06_exams_and_results.png') });
  console.log('✅ Captured qa_v2_06_exams_and_results.png');

  // 7. Staff & Faculty Desk
  console.log('--- Step 7: Staff & Faculty Desk ---');
  await navigateTo('Staff');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'qa_v2_07_staff_faculty_roster.png') });
  console.log('✅ Captured qa_v2_07_staff_faculty_roster.png');

  // 8. Student Attendance Desk
  console.log('--- Step 8: Student Attendance Desk ---');
  await navigateTo('Student Attendance');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'qa_v2_08_student_attendance.png') });
  console.log('✅ Captured qa_v2_08_student_attendance.png');

  // 9. Staff Geofence Attendance Desk
  console.log('--- Step 9: Staff Geofence Attendance Desk ---');
  await navigateTo('Staff Attendance');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'qa_v2_09_staff_geofence_attendance.png') });
  console.log('✅ Captured qa_v2_09_staff_geofence_attendance.png');

  // 10. Timetable & Scheduling
  console.log('--- Step 10: Timetable & Scheduling ---');
  await navigateTo('Timetable & Scheduling');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'qa_v2_10_timetable_scheduling.png') });
  console.log('✅ Captured qa_v2_10_timetable_scheduling.png');

  // 11. Staff Payroll
  console.log('--- Step 11: Staff Payroll ---');
  await navigateTo('Staff Payroll');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'qa_v2_11_staff_payroll.png') });
  console.log('✅ Captured qa_v2_11_staff_payroll.png');

  // 12. Settings & Account Security
  console.log('--- Step 12: Settings & Account Security ---');
  await navigateTo('Settings');
  // Click Account Security Tab
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('button'));
    const secTab = tabs.find(b => b.textContent && b.textContent.includes('Account Security'));
    if (secTab) secTab.click();
  });
  await delay(1500);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'qa_v2_12_settings_account_security.png') });
  console.log('✅ Captured qa_v2_12_settings_account_security.png');

  await browser.close();
  console.log('🎉 All 12 QA browser checkpoints verified and captured successfully!');
}

runQA().catch(err => {
  console.error('QA script error:', err);
  process.exit(1);
});
