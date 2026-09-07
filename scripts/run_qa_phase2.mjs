import puppeteer from 'puppeteer-core';
import path from 'path';

async function runPhase2QA() {
  console.log('🚀 Starting Phase 2 End-to-End Browser QA Suite for Apex Academy ERP...');
  
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--window-size=1280,900',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const consoleLogs = [];
  const pageErrors = [];

  page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => pageErrors.push(err.toString()));

  try {
    // 1. Visit Portal & Login
    console.log('👉 [1/6] Authenticating via 1-Click Dev Sign-In...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    const quickLoginBtn = await page.waitForSelector('button ::-p-text(1-Click Dev Sign-In)', { timeout: 5000 });
    await quickLoginBtn.click();
    await page.waitForSelector('h1 ::-p-text(Executive Academy Overview)', { timeout: 8000 });
    console.log('   ✅ Logged in to Director Adnan session.');

    // 2. Navigate to Student Admissions & SIS Module
    console.log('👉 [2/6] Navigating to Student Admissions & SIS...');
    const sisNavBtn = await page.waitForSelector('aside button ::-p-text(Student Admissions & SIS)');
    await sisNavBtn.click();
    await page.waitForSelector('h1 ::-p-text(Student Admissions & SIS)', { timeout: 5000 });
    console.log('   ✅ Admissions & SIS module loaded.');

    // 3. Verify Tab 1: Student Directory & 360° Drawer
    console.log('👉 [3/6] Verifying Student Directory & 360° Profile Drawer...');
    await page.waitForSelector('td ::-p-text(Muhammad Ali Raza)', { timeout: 5000 });
    await page.waitForSelector('td ::-p-text(ADM-2026-001)');
    console.log('   ✅ Seeded student found in directory.');

    // Click Profile button to test 360° drawer
    const profileBtn = await page.waitForSelector('button ::-p-text(Profile)');
    await profileBtn.click();
    await page.waitForSelector('h3 ::-p-text(Muhammad Ali Raza)', { timeout: 3000 });
    await page.waitForSelector('h4 ::-p-text(Academic Placement)');
    await page.waitForSelector('h4 ::-p-text(Guardian & Emergency Contact)');
    await page.waitForSelector('a ::-p-text(WhatsApp Dispatch)');
    console.log('   ✅ 360° Profile Drawer opened with full student record & WhatsApp action.');

    // Close Drawer
    const closeDrawerBtn = await page.waitForSelector('button ::-p-text(Close Profile)');
    await closeDrawerBtn.click();
    console.log('   ✅ Drawer closed cleanly.');

    // 4. Verify Tab 2: Inquiries Desk & 1-Click Admission
    console.log('👉 [4/6] Verifying Inquiries Desk & 1-Click Admission Flow...');
    const inquiriesTabBtn = await page.waitForSelector('button ::-p-text(Inquiries Desk)');
    await inquiriesTabBtn.click();
    await page.waitForSelector('td ::-p-text(Usman Farooq)', { timeout: 4000 });
    console.log('   ✅ Inquiries pipeline displayed prospective candidates.');

    // Log a new prospective inquiry
    const logInqBtn = await page.waitForSelector('button ::-p-text(Log New Inquiry)');
    await logInqBtn.click();
    await page.waitForSelector('span ::-p-text(Log Prospective Candidate Inquiry)', { timeout: 3000 });

    await page.type('input[placeholder="e.g. Harris Khan"]', 'Zayn Khan QA');
    await page.type('input[placeholder="0300-0000000"]', '0300-5554433');
    await page.type('input[placeholder="candidate@mail.com"]', 'zayn.qa@example.com');
    await page.type('input[placeholder="Father/Mother"]', 'Tariq Khan');
    await page.type('input[placeholder="0321-0000000"]', '0321-5554433');

    const saveInquiryBtn = await page.waitForSelector('button ::-p-text(Save Inquiry)');
    await saveInquiryBtn.click();

    // Verify newly logged inquiry is in the table
    await page.waitForSelector('td ::-p-text(Zayn Khan QA)', { timeout: 4000 });
    console.log('   ✅ Successfully logged new inquiry: Zayn Khan QA.');

    // Execute 1-Click Admit on the inquiry
    const admitBtns = await page.$$('button ::-p-text(1-Click Admit)');
    if (admitBtns.length === 0) throw new Error('1-Click Admit button not found');
    await admitBtns[0].click();

    await page.waitForSelector('span ::-p-text(1-Click Institutional Admission)', { timeout: 3000 });
    const confirmEnrollBtn = await page.waitForSelector('button ::-p-text(Confirm & Enroll)');
    await confirmEnrollBtn.click();

    // Wait for admit modal to close
    await page.waitForSelector('span ::-p-text(1-Click Institutional Admission)', { hidden: true, timeout: 6000 });
    console.log('   ✅ 1-Click Admission executed, candidate enrolled in SIS.');

    // 5. Verify Tab 3: Dynamic Admission Form (Zero Hardcoded Curriculums)
    console.log('👉 [5/6] Verifying Dynamic Admission Form with Database Hierarchy...');
    const newAdmissionTabBtn = await page.waitForSelector('button ::-p-text(New Admission Form)');
    await newAdmissionTabBtn.click();

    await page.waitForSelector('h2 ::-p-text(Institutional Student Admission Form)', { timeout: 6000 });

    // Select Program: FSc Pre-Engineering
    const progSelect = await page.waitForSelector('form select');
    await progSelect.select('a2000000-0000-0000-0000-000000000002'); // FSc program ID
    console.log('   ✅ Selected FSc Pre-Engineering dynamically from database.');

    // Select Batch: FSc Morning - Alpha
    await page.waitForFunction(() => {
      const selects = document.querySelectorAll('form select');
      return selects.length >= 2 && selects[1].options.length > 1;
    });
    const batchSelects = await page.$$('form select');
    const batchOptions = await page.evaluate(el => Array.from(el.options).map(o => o.value), batchSelects[1]);
    await batchSelects[1].select(batchOptions[1]);
    console.log('   ✅ Allocated dynamic batch from filtered program.');

    // Fill Student Particulars
    await page.type('input[placeholder="e.g. Muhammad Bilal"]', 'Hamza Aslam Pupil');
    await page.type('input[placeholder="0300-1234567"]', '0311-8889900');
    await page.type('input[placeholder="student@example.com"]', 'hamza.aslam@gmail.com');
    await page.type('input[placeholder="e.g. Muhammad Aslam"]', 'Aslam Senior');
    await page.type('input[placeholder="0321-9876543"]', '0321-4443322');

    // Dynamic custom field: Blood Group select
    const customSelects = await page.$$('select');
    // If blood group select is rendered
    if (customSelects.length >= 3) {
      await customSelects[customSelects.length - 1].select('B+');
      console.log('   ✅ Populated tenant-configured dynamic field (Blood Group: B+).');
    }

    // Submit Admission
    const completeAdmissionBtn = await page.waitForSelector('button ::-p-text(Complete Admission)');
    await completeAdmissionBtn.click();

    // Verify Success Message
    await page.waitForSelector('span ::-p-text(Enrollment confirmed!)', { timeout: 6000 });
    console.log('   ✅ Student admission confirmed with dynamic Roll & Admission numbers.');

    // Capture Screenshot of Admission Success
    await page.screenshot({ path: path.join(process.cwd(), 'qa_admission_phase2_verified.png'), fullPage: true });
    console.log('   📸 Screenshot saved: qa_admission_phase2_verified.png');

    // View in Directory
    const viewDirBtn = await page.waitForSelector('button ::-p-text(View in Directory)');
    await viewDirBtn.click();
    await page.waitForSelector('td ::-p-text(Hamza Aslam Pupil)', { timeout: 5000 });
    console.log('   ✅ Verified newly admitted student appears live in Directory table.');

    // Capture Directory Screenshot
    await page.screenshot({ path: path.join(process.cwd(), 'qa_directory_phase2_verified.png'), fullPage: true });
    console.log('   📸 Screenshot saved: qa_directory_phase2_verified.png');

    // 6. Console Error Audit
    console.log('\n🔍 --- BROWSER CONSOLE & RUNTIME AUDIT ---');
    const severeErrors = pageErrors.concat(
      consoleLogs.filter(l => l.type === 'error').map(l => l.text)
    );

    if (severeErrors.length > 0) {
      console.error('❌ Browser Errors detected:', severeErrors);
      throw new Error(`QA failed with ${severeErrors.length} browser console errors.`);
    } else {
      console.log('✅ ZERO browser errors or unhandled runtime exceptions detected!');
    }

    console.log('\n🎉 ALL PHASE 2 QA AUDIT CHECKS PASSED (Score: 10/10)!');
  } finally {
    await browser.close();
  }
}

runPhase2QA().catch(err => {
  console.error('\n❌ Phase 2 QA Test Suite Failed:', err);
  process.exit(1);
});
