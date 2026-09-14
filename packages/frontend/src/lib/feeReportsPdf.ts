import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { 
  AcademyLetterhead, 
  createOfficialDocument, 
  downloadPdfBytes, 
  PdfTableColumn 
} from './officialDocumentPdf';

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 36;
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
  late_fee_fine?: number;
  total_after_due_date?: number;
}

export interface BatchChallanPdfOptions {
  academy: AcademyLetterhead;
  bankDetails?: {
    bankName: string;
    accountTitle: string;
    accountNumber: string;
    branchName?: string;
  };
  layout: '3_per_page' | '2_per_page';
  challans: StudentChallanData[];
}

/**
 * Builds the PDF bytes for a tabular fee report with pagination and summary boxes.
 */
export async function buildTabularFeeReportPdfBytes(opts: ReportOptions): Promise<Uint8Array> {
  const { doc, font, fontBold, addPage, width, height } = await createOfficialDocument(opts.title, opts.academy);

  let currentPage: PDFPage = addPage();
  let y = height - 90;

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

  const totalTableWidth = opts.columns.reduce((s, c) => s + c.width, 0);

  const drawTableHeader = (page: PDFPage, atY: number) => {
    page.drawRectangle({
      x: MARGIN,
      y: atY - 4,
      width: totalTableWidth,
      height: 16,
      color: rgb(0.93, 0.95, 0.97),
      borderColor: RULE,
      borderWidth: 0.5,
    });
    let x = MARGIN;
    for (const col of opts.columns) {
      const tx = col.align === 'right' 
        ? x + col.width - 6 - fontBold.widthOfTextAtSize(col.label.toUpperCase(), 7) 
        : x + 5;
      page.drawText(col.label.toUpperCase(), { x: tx, y: atY, size: 7, font: fontBold, color: SLATE });
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
    for (const col of opts.columns) {
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

/**
 * Builds high-density, authentic institutional Fee Challans in vertical A4 format (Portrait).
 * Supports 3 copies per page (Bank, Academy, Student) or 2 copies per page (Academy, Student).
 */
export async function buildBatchChallansPdfBytes(opts: BatchChallanPdfOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const [pageWidth, pageHeight] = A4;
  const copies = opts.layout === '3_per_page' 
    ? ['BANK COPY', 'ACADEMY COPY', 'STUDENT COPY'] 
    : ['ACADEMY COPY', 'STUDENT COPY'];

  const leftMargin = opts.layout === '3_per_page' ? 16 : 24;
  const rightMargin = opts.layout === '3_per_page' ? 16 : 24;
  const gutter = opts.layout === '3_per_page' ? 12 : 20;
  const usableWidth = pageWidth - leftMargin - rightMargin;
  const colWidth = (usableWidth - ((copies.length - 1) * gutter)) / copies.length;

  for (const ch of opts.challans) {
    const page = doc.addPage(A4);

    // Draw vertical separator dashed cut-lines between copies
    for (let cIdx = 0; cIdx < copies.length - 1; cIdx++) {
      const sepX = leftMargin + (colWidth * (cIdx + 1)) + (gutter * cIdx) + (gutter / 2);
      
      // Draw dashed line
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

      // Small cut-here indicator in center
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

    // Render each copy column
    copies.forEach((copyLabel, cIdx) => {
      const colX = leftMargin + (cIdx * (colWidth + gutter));
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
      const acadName = opts.academy.name;
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

      const subLine = [opts.academy.campus, opts.academy.phone].filter(Boolean).join(' | ');
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
      if (opts.bankDetails) {
        const bText = `${opts.bankDetails.bankName} - A/C: ${opts.bankDetails.accountNumber}`;
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
        page.drawText(item.head_name, { x: colX + 4, y, size: 7, font, color: INK });
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

      // Concession discount line if present
      if (ch.concession_amount && ch.concession_amount > 0) {
        page.drawText('Fee Concession / Scholarship', { x: colX + 4, y, size: 7, font, color: rgb(0.1, 0.5, 0.2) });
        const discStr = `-${Number(ch.concession_amount).toLocaleString()}`;
        const discW = font.widthOfTextAtSize(discStr, 7);
        page.drawText(discStr, { x: colX + colWidth - 8 - discW, y, size: 7, font: fontBold, color: rgb(0.1, 0.5, 0.2) });
        y -= 12;
      }

      // Arrears / Previous balance if present
      if (ch.arrears_amount && ch.arrears_amount > 0) {
        page.drawText('Arrears / Previous Balance', { x: colX + 4, y, size: 7, font, color: rgb(0.8, 0.2, 0.1) });
        const arrStr = Number(ch.arrears_amount).toLocaleString();
        const arrW = font.widthOfTextAtSize(arrStr, 7);
        page.drawText(arrStr, { x: colX + colWidth - 8 - arrW, y, size: 7, font: fontBold, color: rgb(0.8, 0.2, 0.1) });
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
      page.drawText('PAYABLE BY DUE DATE:', { x: colX + 4, y: y - 13, size: 7, font: fontBold, color: NAVY });
      const netStr = `PKR ${Number(ch.net_amount).toLocaleString()}`;
      const netW = fontBold.widthOfTextAtSize(netStr, 8.5);
      page.drawText(netStr, { x: colX + colWidth - 6 - netW, y: y - 13, size: 8.5, font: fontBold, color: NAVY });
      y -= 24;

      // Late fee surcharge and after due date
      const lateFine = ch.late_fee_fine || 200;
      const afterDue = ch.total_after_due_date || (ch.net_amount + lateFine);

      page.drawText('Late Fee Surcharge:', { x: colX + 4, y, size: 6.5, font, color: SLATE });
      const fineStr = `PKR ${Number(lateFine).toLocaleString()}`;
      const fineW = font.widthOfTextAtSize(fineStr, 6.5);
      page.drawText(fineStr, { x: colX + colWidth - 6 - fineW, y, size: 6.5, font, color: SLATE });
      y -= 12;

      page.drawRectangle({
        x: colX,
        y: y - 14,
        width: colWidth,
        height: 16,
        color: rgb(0.99, 0.95, 0.95),
        borderColor: rgb(0.9, 0.75, 0.75),
        borderWidth: 0.5,
      });
      page.drawText('PAYABLE AFTER DUE DATE:', { x: colX + 4, y: y - 10, size: 6.5, font: fontBold, color: rgb(0.65, 0.1, 0.1) });
      const afterStr = `PKR ${Number(afterDue).toLocaleString()}`;
      const afterW = fontBold.widthOfTextAtSize(afterStr, 7.5);
      page.drawText(afterStr, { x: colX + colWidth - 6 - afterW, y: y - 10, size: 7.5, font: fontBold, color: rgb(0.65, 0.1, 0.1) });
      y -= 22;

      // 7. Instructions
      page.drawText('INSTRUCTIONS:', { x: colX + 2, y, size: 6, font: fontBold, color: SLATE });
      y -= 8;
      const instructions = [
        '1. Please deposit fee on or before due date.',
        '2. Late surcharge automatically applies after due date.',
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
    });
  }

  return await doc.save();
}
