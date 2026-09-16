import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';

const A4: [number, number] = [595.28, 841.89];
import { 
  AcademyLetterhead, 
  createOfficialDocument, 
  downloadPdfBytes, 
  PdfTableColumn,
  MARGIN,
} from './officialDocumentPdf';
const SLATE = rgb(0.35, 0.39, 0.45);
const RULE = rgb(0.86, 0.88, 0.91);
const INK = rgb(0.07, 0.09, 0.15);
const NAVY = rgb(0.06, 0.09, 0.16);
const LIGHT_BG = rgb(0.96, 0.97, 0.99);

export interface ReportOptions {
  title: string;
  academy: AcademyLetterhead;
  filterInfo?: { label: string; value: string }[];
  columns: PdfTableColumn[];
  rows: Record<string, string>[];
  summaryStrip?: { label: string; value: string }[];
  filename: string;
  landscape?: boolean;
}

export interface ChallanItem {
  head_name: string;
  amount: number;
}

export interface StudentChallanData {
  challan_number: string;
  roll_number: string;
  admission_number?: string;
  student_name: string;
  father_name: string;
  class_name: string;
  batch_name?: string;
  billing_month: string;
  issue_date: string;
  due_date: string;
  items: ChallanItem[];
  concession_amount?: number;
  arrears_amount?: number;
  net_amount: number;
  history_months?: Array<{ month: string; paid: number; balance: number }>;
}

export interface BatchChallanPdfOptions {
  academy: AcademyLetterhead;
  bankDetails?: {
    bankName: string;
    accountTitle: string;
    accountNumber: string;
    branchName?: string;
  };
  layout?: '3_per_page' | '2_per_page';
  challans: StudentChallanData[];
}

/**
 * Builds the PDF bytes for a tabular fee report with pagination and summary boxes.
 */
export async function buildTabularFeeReportPdfBytes(opts: ReportOptions): Promise<Uint8Array> {
  const { doc, font, fontBold, addPage, width, height } = await createOfficialDocument(opts.title, opts.academy, { landscape: opts.landscape });

  let currentPage: PDFPage = addPage();
  let y = height - 72;

  // Filter / Metadata subtitle line if available
  if (opts.filterInfo && opts.filterInfo.length > 0) {
    const metaStr = opts.filterInfo.map(f => `${f.label}: ${f.value}`).join('   |   ');
    currentPage.drawText(metaStr, { x: MARGIN, y, size: 8, font: fontBold, color: SLATE });
    y -= 14;
  }

  // Summary Strip if available
  if (opts.summaryStrip && opts.summaryStrip.length > 0) {
    const boxWidth = Math.min(130, (width - (MARGIN * 2) - ((opts.summaryStrip.length - 1) * 8)) / opts.summaryStrip.length);
    let boxX = MARGIN;
    for (const item of opts.summaryStrip) {
      currentPage.drawRectangle({
        x: boxX,
        y: y - 26,
        width: boxWidth,
        height: 26,
        color: rgb(0.97, 0.98, 0.99),
        borderColor: RULE,
        borderWidth: 0.5,
      });
      currentPage.drawText(item.label.toUpperCase(), {
        x: boxX + 6,
        y: y - 10,
        size: 6.5,
        font: fontBold,
        color: SLATE,
      });
      currentPage.drawText(item.value, {
        x: boxX + 6,
        y: y - 21,
        size: 9,
        font: fontBold,
        color: INK,
      });
      boxX += boxWidth + 8;
    }
    y -= 38;
  }

  const rawTableWidth = opts.columns.reduce((s, c) => s + c.width, 0);
  const usable = width - MARGIN * 2;
  const scale = rawTableWidth > 0 ? usable / rawTableWidth : 1;
  const cols = opts.columns.map(c => ({ ...c, width: c.width * scale }));
  const totalTableWidth = usable;

  const drawTableHeader = (page: PDFPage, atY: number) => {
    page.drawRectangle({
      x: MARGIN,
      y: atY - 4,
      width: totalTableWidth,
      height: 16,
      color: rgb(0.08, 0.11, 0.18),
    });
    let x = MARGIN;
    for (const col of cols) {
      const label = col.label.toUpperCase();
      const tx = col.align === 'right' 
        ? x + col.width - 6 - fontBold.widthOfTextAtSize(label, 7) 
        : x + 5;
      page.drawText(label, { x: tx, y: atY, size: 7, font: fontBold, color: rgb(1, 1, 1) });
      x += col.width;
    }
    return atY - 18;
  };

  y = drawTableHeader(currentPage, y);

  // Table rows with automatic pagination
  for (let idx = 0; idx < opts.rows.length; idx++) {
    const row = opts.rows[idx];

    // Check if we need a new page
    if (y < 55) {
      currentPage = addPage();
      y = height - 90;
      y = drawTableHeader(currentPage, y);
    }

    // Row zebra background
    if (idx % 2 === 1) {
      currentPage.drawRectangle({
        x: MARGIN,
        y: y - 3,
        width: totalTableWidth,
        height: 14,
        color: rgb(0.985, 0.99, 1),
      });
    }

    // Border line under each row
    currentPage.drawLine({
      start: { x: MARGIN, y: y + 9 },
      end: { x: MARGIN + totalTableWidth, y: y + 9 },
      thickness: 0.3,
      color: RULE,
    });

    let x = MARGIN;
    for (const col of cols) {
      const rawText = row[col.key] || '—';
      let text = rawText;
      while (text.length > 3 && font.widthOfTextAtSize(text, 7.5) > col.width - 8) {
        text = text.slice(0, -1);
      }
      if (text.length < rawText.length) text += '…';

      const tw = font.widthOfTextAtSize(text, 7.5);
      const tx = col.align === 'right' ? x + col.width - 5 - tw : x + 5;
      currentPage.drawText(text, { x: tx, y: y, size: 7.5, font, color: INK });
      x += col.width;
    }

    y -= 14;
  }

  // Final table bottom line
  currentPage.drawLine({
    start: { x: MARGIN, y: y + 9 },
    end: { x: MARGIN + totalTableWidth, y: y + 9 },
    thickness: 0.5,
    color: SLATE,
  });

  return await doc.save();
}

/**
 * Convenience wrapper: Generates tabular report and triggers browser file download.
 */
export async function generateTabularFeeReportPdf(opts: ReportOptions) {
  const bytes = await buildTabularFeeReportPdfBytes(opts);
  await downloadPdfBytes(bytes, opts.filename);
}

function drawCutLine(page: PDFPage, sepX: number, pageHeight: number, font: any) {
  let dotY = pageHeight - 30;
  while (dotY > 30) {
    page.drawLine({
      start: { x: sepX, y: dotY },
      end: { x: sepX, y: dotY - 6 },
      thickness: 0.5,
      color: rgb(0.75, 0.78, 0.82),
    });
    dotY -= 10;
  }

  page.drawRectangle({
    x: sepX - 22,
    y: (pageHeight / 2) - 8,
    width: 44,
    height: 14,
    color: rgb(1, 1, 1),
  });
  page.drawText('- - Cut Here - -', {
    x: sepX - 20,
    y: (pageHeight / 2) - 4,
    size: 5.5,
    font,
    color: SLATE,
  });
}

function renderChallanColumn(
  page: PDFPage,
  colX: number,
  colWidth: number,
  ch: StudentChallanData,
  copyLabel: string,
  academy: AcademyLetterhead,
  bankDetails: BatchChallanPdfOptions['bankDetails'],
  font: any,
  fontBold: any,
  pageHeight: number
) {
  let y = pageHeight - 32;

  // 1. Copy Badge
  page.drawRectangle({
    x: colX,
    y: y - 13,
    width: colWidth,
    height: 15,
    color: rgb(0.92, 0.94, 0.97),
    borderColor: RULE,
    borderWidth: 0.5,
  });
  const badgeTextWidth = fontBold.widthOfTextAtSize(copyLabel, 7.5);
  page.drawText(copyLabel, {
    x: colX + (colWidth - badgeTextWidth) / 2,
    y: y - 9,
    size: 7.5,
    font: fontBold,
    color: NAVY,
  });
  y -= 22;

  // 2. Academy Header
  const acadName = academy.name;
  let acadFontSize = colWidth < 200 ? 9 : 11;
  const acadNameWidth = fontBold.widthOfTextAtSize(acadName, acadFontSize);
  page.drawText(acadName, {
    x: colX + Math.max(0, (colWidth - acadNameWidth) / 2),
    y,
    size: acadFontSize,
    font: fontBold,
    color: NAVY,
  });
  y -= 10;

  const subLine = [academy.campus, academy.phone].filter(Boolean).join(' | ');
  if (subLine) {
    const subW = font.widthOfTextAtSize(subLine, 6.5);
    page.drawText(subLine, {
      x: colX + Math.max(0, (colWidth - subW) / 2),
      y,
      size: 6.5,
      font,
      color: SLATE,
    });
    y -= 9;
  }

  // Bank Collection Details
  if (bankDetails) {
    const bText = `${bankDetails.bankName} - A/C: ${bankDetails.accountNumber}`;
    const bW = fontBold.widthOfTextAtSize(bText, 6.5);
    page.drawText(bText, {
      x: colX + Math.max(0, (colWidth - bW) / 2),
      y,
      size: 6.5,
      font: fontBold,
      color: SLATE,
    });
    y -= 10;
  }

  // Horizontal separator rule
  page.drawLine({
    start: { x: colX, y },
    end: { x: colX + colWidth, y },
    thickness: 0.6,
    color: RULE,
  });
  y -= 8;

  // 3. Challan Meta Box
  page.drawRectangle({
    x: colX,
    y: y - 28,
    width: colWidth,
    height: 28,
    color: LIGHT_BG,
    borderColor: RULE,
    borderWidth: 0.5,
  });

  page.drawText('CHALLAN #:', { x: colX + 4, y: y - 10, size: 6.5, font: fontBold, color: SLATE });
  page.drawText(ch.challan_number, { x: colX + 48, y: y - 10, size: 7.5, font: fontBold, color: NAVY });

  page.drawText('MONTH:', { x: colX + 4, y: y - 22, size: 6.5, font: fontBold, color: SLATE });
  page.drawText(ch.billing_month, { x: colX + 48, y: y - 22, size: 7, font, color: INK });

  const dueBoxX = colX + colWidth - 68;
  page.drawRectangle({
    x: dueBoxX,
    y: y - 26,
    width: 64,
    height: 24,
    color: rgb(1, 0.95, 0.95),
    borderColor: rgb(0.9, 0.7, 0.7),
    borderWidth: 0.5,
  });
  page.drawText('DUE DATE', { x: dueBoxX + 12, y: y - 9, size: 6, font: fontBold, color: rgb(0.7, 0.1, 0.1) });
  page.drawText(ch.due_date, { x: dueBoxX + 6, y: y - 20, size: 7.5, font: fontBold, color: rgb(0.7, 0.1, 0.1) });
  y -= 34;

  // 4. Student Details Box
  const detailRows = [
    ['Roll No:', ch.roll_number, 'Adm No:', ch.admission_number || '—'],
    ['Student:', ch.student_name, '', ''],
    ['Father:', ch.father_name, '', ''],
    ['Class:', `${ch.class_name}${ch.batch_name ? ' (' + ch.batch_name + ')' : ''}`, '', ''],
  ];

  for (const dRow of detailRows) {
    page.drawText(dRow[0], { x: colX + 2, y, size: 7, font: fontBold, color: SLATE });
    page.drawText(dRow[1], { x: colX + 42, y, size: 7.5, font: fontBold, color: INK });

    if (dRow[2]) {
      page.drawText(dRow[2], { x: colX + colWidth - 65, y, size: 6.5, font: fontBold, color: SLATE });
      page.drawText(dRow[3], { x: colX + colWidth - 32, y, size: 7, font, color: INK });
    }
    y -= 11;
  }
  y -= 2;

  // 5. Fee Breakdown Table
  page.drawRectangle({
    x: colX,
    y: y - 12,
    width: colWidth,
    height: 14,
    color: rgb(0.93, 0.95, 0.97),
    borderColor: RULE,
    borderWidth: 0.5,
  });
  page.drawText('PARTICULARS / HEAD', { x: colX + 4, y: y - 8, size: 6.5, font: fontBold, color: SLATE });
  page.drawText('AMOUNT (PKR)', { x: colX + colWidth - 56, y: y - 8, size: 6.5, font: fontBold, color: SLATE });
  y -= 16;

  // List Heads
  const itemsToDisplay = ch.items && ch.items.length > 0 
    ? ch.items 
    : [{ head_name: 'Tuition Fee', amount: ch.net_amount }];

  for (const item of itemsToDisplay) {
    const cleanHeadName = item.head_name.replace(/\s*\(?arrears?\)?/gi, '').trim() || item.head_name;
    page.drawText(cleanHeadName, { x: colX + 4, y, size: 7, font, color: INK });
    const amtStr = Number(item.amount).toLocaleString();
    const amtW = font.widthOfTextAtSize(amtStr, 7);
    page.drawText(amtStr, { x: colX + colWidth - 8 - amtW, y, size: 7, font, color: INK });

    page.drawLine({
      start: { x: colX, y: y - 3 },
      end: { x: colX + colWidth, y: y - 3 },
      thickness: 0.3,
      color: RULE,
    });
    y -= 12;
  }

  y -= 2;

  // 6. Total Box (Within Due Date)
  page.drawRectangle({
    x: colX,
    y: y - 18,
    width: colWidth,
    height: 20,
    color: rgb(0.95, 0.97, 1),
    borderColor: rgb(0.7, 0.8, 0.95),
    borderWidth: 0.8,
  });
  page.drawText('TOTAL PAYABLE AMOUNT:', { x: colX + 4, y: y - 13, size: 7, font: fontBold, color: NAVY });
  const netStr = `PKR ${Number(ch.net_amount).toLocaleString()}`;
  const netW = fontBold.widthOfTextAtSize(netStr, 8.5);
  page.drawText(netStr, { x: colX + colWidth - 6 - netW, y: y - 13, size: 8.5, font: fontBold, color: NAVY });
  y -= 24;

  // 7. Last 4 Months History Box
  if (ch.history_months && ch.history_months.length > 0) {
    page.drawRectangle({
      x: colX,
      y: y - 11,
      width: colWidth,
      height: 12,
      color: rgb(0.93, 0.95, 0.97),
      borderColor: RULE,
      borderWidth: 0.5,
    });
    page.drawText('LAST 4 MONTHS HISTORY', { x: colX + 4, y: y - 8, size: 5.5, font: fontBold, color: SLATE });
    page.drawText('PAID', { x: colX + colWidth - 60, y: y - 8, size: 5.5, font: fontBold, color: SLATE });
    page.drawText('BAL', { x: colX + colWidth - 24, y: y - 8, size: 5.5, font: fontBold, color: SLATE });
    y -= 13;

    for (const hRow of ch.history_months.slice(0, 4)) {
      page.drawText(hRow.month, { x: colX + 4, y, size: 6, font, color: INK });
      const pStr = Number(hRow.paid).toLocaleString();
      const pW = font.widthOfTextAtSize(pStr, 6);
      page.drawText(pStr, { x: colX + colWidth - 42 - pW, y, size: 6, font, color: INK });

      const bStr = Number(hRow.balance).toLocaleString();
      const bW = font.widthOfTextAtSize(bStr, 6);
      page.drawText(bStr, { x: colX + colWidth - 6 - bW, y, size: 6, font, color: INK });

      page.drawLine({
        start: { x: colX, y: y - 2 },
        end: { x: colX + colWidth, y: y - 2 },
        thickness: 0.2,
        color: RULE,
      });
      y -= 8.5;
    }
    y -= 4;
  }

  // 8. Instructions
  page.drawText('INSTRUCTIONS:', { x: colX + 2, y, size: 6, font: fontBold, color: SLATE });
  y -= 8;
  const instructions = [
    '1. Please deposit fee on or before due date.',
    '2. Retain deposit receipt for academy records.',
    '3. Fee once deposited is strictly non-refundable.',
  ];
  for (const inst of instructions) {
    page.drawText(inst, { x: colX + 2, y, size: 5.5, font, color: SLATE });
    y -= 7;
  }
  y -= 16;

  // 8. Signatures
  page.drawLine({
    start: { x: colX + 4, y },
    end: { x: colX + 55, y },
    thickness: 0.4,
    color: SLATE,
  });
  page.drawLine({
    start: { x: colX + colWidth - 65, y },
    end: { x: colX + colWidth - 4, y },
    thickness: 0.4,
    color: SLATE,
  });
  y -= 8;
  page.drawText('Depositor Signature', { x: colX + 4, y, size: 5.5, font, color: SLATE });
  page.drawText('Cashier / Officer', { x: colX + colWidth - 58, y, size: 5.5, font, color: SLATE });
}

/**
 * Builds high-density, authentic institutional Fee Challans in vertical A4 format (Portrait).
 * - Single student voucher: 1 page with 3 tripartite sections (Bank Copy, Admin Copy, Student Copy).
 * - Multiple student vouchers: 3 students' challans printed per page (1 voucher per student).
 */
export async function buildBatchChallansPdfBytes(opts: BatchChallanPdfOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const [pageWidth, pageHeight] = A4;
  const leftMargin = 16;
  const rightMargin = 16;
  const gutter = 12;
  const columnsCount = 3;
  const usableWidth = pageWidth - leftMargin - rightMargin;
  const colWidth = (usableWidth - ((columnsCount - 1) * gutter)) / columnsCount;

  // Case 1: Single student challan -> 1 page with 3 tripartite sections (Bank, Admin, Student)
  if (opts.challans.length === 1) {
    const ch = opts.challans[0];
    const page = doc.addPage(A4);
    const copies = ['BANK COPY', 'ADMIN COPY', 'STUDENT COPY'];

    // Draw vertical separator dashed cut-lines between copies
    for (let cIdx = 0; cIdx < copies.length - 1; cIdx++) {
      const sepX = leftMargin + (colWidth * (cIdx + 1)) + (gutter * cIdx) + (gutter / 2);
      drawCutLine(page, sepX, pageHeight, font);
    }

    // Render each copy column for this student
    copies.forEach((copyLabel, cIdx) => {
      const colX = leftMargin + (cIdx * (colWidth + gutter));
      renderChallanColumn(page, colX, colWidth, ch, copyLabel, opts.academy, opts.bankDetails, font, fontBold, pageHeight);
    });
  } else {
    // Case 2: Multiple students -> 3 students per A4 page
    const pageSize = 3;
    for (let i = 0; i < opts.challans.length; i += pageSize) {
      const chunk = opts.challans.slice(i, i + pageSize);
      const page = doc.addPage(A4);

      // Draw vertical separator dashed cut-lines between student columns
      for (let cIdx = 0; cIdx < chunk.length - 1; cIdx++) {
        const sepX = leftMargin + (colWidth * (cIdx + 1)) + (gutter * cIdx) + (gutter / 2);
        drawCutLine(page, sepX, pageHeight, font);
      }

      // Render each student in their own column
      chunk.forEach((ch, cIdx) => {
        const colX = leftMargin + (cIdx * (colWidth + gutter));
        renderChallanColumn(page, colX, colWidth, ch, 'FEE CHALLAN', opts.academy, opts.bankDetails, font, fontBold, pageHeight);
      });
    }
  }

  return await doc.save();
}
