/**
 * Official A6 Vertical Fee Slip & Payment Receipt Picture Generator
 *
 * Renders publication-grade A6 Vertical (105mm x 148mm ratio: 600x850 @ 2x high-DPI)
 * document slips for:
 * 1. Pending Due Reminder Slips
 * 2. Receiving Payment Receipts
 *
 * Supports auto-copying PNG to clipboard for instant Ctrl+V pasting in WhatsApp,
 * auto-downloads PNG file, and redirects via https://wa.me/ (ZERO WhatsApp API).
 * Displays official academy branding with discrete "Powered by kampus.pk" logo branding.
 */

export interface FeeSlipData {
  slip_type: 'due_reminder' | 'payment_receipt';
  receipt_number?: string;
  invoice_number: string;
  billing_month: string;
  due_date?: string;
  issue_date?: string;
  payment_date?: string;
  payment_method?: string;
  reference_number?: string;
  bank_name?: string;
  cheque_number?: string;
  collected_by?: string;
  student_name: string;
  roll_number?: string;
  admission_number?: string;
  father_name?: string;
  guardian_phone?: string;
  program_name?: string;
  batch_name?: string;
  items: Array<{
    head_name: string;
    amount: number;
    paid_amount?: number;
    balance_due?: number;
    allocated_amount?: number;
  }>;
  gross_amount: number;
  discount_amount?: number;
  paid_amount: number;
  balance_due: number;
  status: string;
  notes?: string;
}

export interface AcademyInfo {
  name: string;
  campus?: string;
  session?: string;
  phone?: string;
  email?: string;
  address?: string;
  bank_name?: string;
  account_title?: string;
  account_number?: string;
  iban?: string;
  easypaisa_number?: string;
  jazzcash_number?: string;
}

/**
 * Preloads image safely
 */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Render high-resolution A6 Vertical (600px x 850px @ 2x scale) PNG slip on Canvas
 */
/**
 * Number to words converter for Pakistani Rupees
 */
export function numberToWords(num: number): string {
  const n = Math.floor(Math.abs(num || 0));
  if (n === 0) return 'Zero Rupees Only';

  const units = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function chunkToWords(val: number): string {
    let str = '';
    if (val >= 100) {
      str += units[Math.floor(val / 100)] + ' Hundred ';
      val %= 100;
      if (val > 0) str += 'and ';
    }
    if (val > 0) {
      if (val < 20) {
        str += units[val] + ' ';
      } else {
        str += tens[Math.floor(val / 10)] + ' ';
        if (val % 10 > 0) {
          str += units[val % 10] + ' ';
        }
      }
    }
    return str;
  }

  let words = '';
  const crore = Math.floor(n / 10000000);
  let rem = n % 10000000;
  const lakh = Math.floor(rem / 100000);
  rem = rem % 100000;
  const thousand = Math.floor(rem / 1000);
  rem = rem % 1000;

  if (crore > 0) words += chunkToWords(crore) + 'Crore ';
  if (lakh > 0) words += chunkToWords(lakh) + 'Lakh ';
  if (thousand > 0) words += chunkToWords(thousand) + 'Thousand ';
  if (rem > 0) words += chunkToWords(rem);

  return words.trim() + ' Rupees Only';
}

/**
 * Render publication-grade A6 Vertical (600px x 850px @ 2x scale) PNG slip on Canvas
 * Theme: Midnight Navy & Saffron Golden-Yellow with Scalloped Wave Divider & Geometric Accents
 */
export async function renderFeeSlipCanvas(slip: FeeSlipData, academy: AcademyInfo): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const width = 600;
  const height = 850;
  const scale = 2; // High-DPI 2x scale (1200 x 1700) for crystal clear display & print

  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  ctx.scale(scale, scale);

  const isReceipt = slip.slip_type === 'payment_receipt';

  // ---------------------------------------------------------------------------
  // 1. BASE BACKGROUND & PERFORATION GUIDELINE
  // ---------------------------------------------------------------------------
  // Deep Midnight Navy base
  ctx.fillStyle = '#0a1a3b';
  ctx.fillRect(0, 0, width, height);

  // Top-Left Corner Geometric Arcs (concentric white line quarter-circles)
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2.2;
  [22, 42, 62, 82].forEach(r => {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI / 2);
    ctx.stroke();
  });
  ctx.restore();

  // Bottom-Right Corner Geometric Arcs
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2.2;
  [24, 46, 68, 90].forEach(r => {
    ctx.beginPath();
    ctx.arc(width, height, r, Math.PI, Math.PI * 1.5);
    ctx.stroke();
  });
  ctx.restore();

  // Vertical Perforation Line on far right margin (voucher tear-off indicator)
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(width - 8, 0);
  ctx.lineTo(width - 8, height);
  ctx.stroke();
  ctx.restore();

  // ---------------------------------------------------------------------------
  // 2. TOP HEADER BANNER (NAVY WITH GOLDEN YELLOW BADGE)
  // ---------------------------------------------------------------------------
  // Geometric Academy Emblem (triangle crest icon matching reference)
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(42, 48);
  ctx.lineTo(54, 25);
  ctx.lineTo(66, 48);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(54, 41, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Academy Name & Tagline
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 17px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(academy.name.toUpperCase(), 74, 38);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 9px system-ui, -apple-system, sans-serif';
  const tagline = [academy.campus || 'MAIN CAMPUS', academy.session || 'SESSION 2026-2027'].join('  •  ');
  ctx.fillText(tagline.toUpperCase(), 74, 53);

  // Golden Yellow Badge Box on Top Right
  const badgeWidth = 216;
  const badgeHeight = 54;
  const badgeX = width - 240;
  const badgeY = 16;

  ctx.fillStyle = '#ffb40e';
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 3);
  ctx.fill();

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0a1a3b';
  ctx.font = '900 19px system-ui, -apple-system, sans-serif';
  ctx.fillText(isReceipt ? 'RECEIPT' : 'FEE DUE SLIP', width - 36, 43);
  ctx.font = 'bold 8.5px system-ui, -apple-system, sans-serif';
  ctx.fillText(isReceipt ? 'ACADEMY FINANCIAL COPY' : 'STUDENT DUES VOUCHER', width - 36, 58);

  // ---------------------------------------------------------------------------
  // 3. WHITE UPPER SECTION (ACADEMY CONTACT & SEGMENTED DATE / VOUCHER NO)
  // ---------------------------------------------------------------------------
  const whiteY = 82;
  const whiteHeight = 120;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(16, whiteY, width - 32, whiteHeight);

  // Left Side: Academy Particulars
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0a1a3b';
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
  ctx.fillText(academy.name, 34, 104);

  const drawInfoRow = (label: string, val: string, yPos: number) => {
    ctx.fillStyle = '#0a1a3b';
    ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
    ctx.fillText(label, 34, yPos);
    ctx.fillStyle = '#475569';
    ctx.font = '500 9px system-ui, -apple-system, sans-serif';
    ctx.fillText(val, 88, yPos);
  };

  drawInfoRow('Address:', academy.campus || academy.address || 'Campus Facility', 122);
  if (academy.phone) drawInfoRow('Phone:', academy.phone, 139);
  if (academy.email) drawInfoRow('Mail:', academy.email, 156);

  // Right Side: Segmented Date Box (Day / Month / Year with underlines)
  const dateRaw = isReceipt
    ? (slip.payment_date || new Date().toISOString().split('T')[0])
    : (slip.issue_date || new Date().toISOString().split('T')[0]);

  const dateObj = new Date(dateRaw);
  const dayStr = dateObj.getDate().toString().padStart(2, '0');
  const monthStr = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const yearStr = dateObj.getFullYear().toString();

  ctx.fillStyle = '#0a1a3b';
  ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
  ctx.fillText('Date', 310, 114);

  // Day underline & label
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0a1a3b';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(dayStr, 368, 114);
  ctx.strokeStyle = '#0a1a3b';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(346, 118);
  ctx.lineTo(390, 118);
  ctx.stroke();
  ctx.fillStyle = '#64748b';
  ctx.font = '600 7.5px system-ui, sans-serif';
  ctx.fillText('DAY', 368, 128);

  // Month underline & label
  ctx.fillStyle = '#0a1a3b';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(monthStr, 432, 114);
  ctx.beginPath();
  ctx.moveTo(404, 118);
  ctx.lineTo(460, 118);
  ctx.stroke();
  ctx.fillStyle = '#64748b';
  ctx.font = '600 7.5px system-ui, sans-serif';
  ctx.fillText('MONTH', 432, 128);

  // Year underline & label
  ctx.fillStyle = '#0a1a3b';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(yearStr, 506, 114);
  ctx.beginPath();
  ctx.moveTo(474, 118);
  ctx.lineTo(538, 118);
  ctx.stroke();
  ctx.fillStyle = '#64748b';
  ctx.font = '600 7.5px system-ui, sans-serif';
  ctx.fillText('YEAR', 506, 128);

  // Receipt No / Challan No Row
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0a1a3b';
  ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
  ctx.fillText(isReceipt ? 'Receipt No.' : 'Challan No.', 310, 154);

  const voucherNum = isReceipt
    ? (slip.receipt_number || 'REC-CONFIRMED')
    : slip.invoice_number;

  ctx.fillStyle = '#0a1a3b';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(voucherNum, 386, 154);

  ctx.beginPath();
  ctx.moveTo(380, 158);
  ctx.lineTo(width - 34, 158);
  ctx.stroke();

  // Billing Month / Due Date Note
  ctx.fillStyle = '#64748b';
  ctx.font = '500 8.5px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Billing Month: ${slip.billing_month}   •   Due: ${slip.due_date || 'Prompt'}`, 310, 178);

  // ---------------------------------------------------------------------------
  // 4. SCALLOPED / UNDULATING WAVE DIVIDER & MAIN SAFFRON-YELLOW CARD
  // ---------------------------------------------------------------------------
  const cardX = 16;
  const cardWidth = width - 32;
  const waveBaseY = 202;
  const cardBottomY = 788;
  const cornerRadius = 18;

  // Draw Scalloped Undulating Wave at top of Golden-Yellow card
  ctx.fillStyle = '#feb608'; // Saffron Golden-Yellow
  ctx.beginPath();
  ctx.moveTo(cardX, waveBaseY);

  const numScallops = 14;
  const scallopWidth = cardWidth / numScallops;
  const amplitude = 9;

  for (let i = 0; i < numScallops; i++) {
    const xStart = cardX + i * scallopWidth;
    const xMid = xStart + scallopWidth / 2;
    const xEnd = xStart + scallopWidth;
    ctx.quadraticCurveTo(xMid, waveBaseY - amplitude, xEnd, waveBaseY);
  }

  // Right vertical edge down to bottom with rounded corner
  ctx.lineTo(cardX + cardWidth, cardBottomY - cornerRadius);
  ctx.quadraticCurveTo(cardX + cardWidth, cardBottomY, cardX + cardWidth - cornerRadius, cardBottomY);
  // Bottom horizontal edge to left with rounded corner
  ctx.lineTo(cardX + cornerRadius, cardBottomY);
  ctx.quadraticCurveTo(cardX, cardBottomY, cardX, cardBottomY - cornerRadius);
  // Left vertical edge back up to wave start
  ctx.lineTo(cardX, waveBaseY);
  ctx.closePath();
  ctx.fill();

  // Subtle Geometric Triangle Watermark Pattern across the Yellow Card
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1.3;
  const triSide = 32;
  const triHeight = triSide * 0.866;
  for (let ty = waveBaseY + 45; ty < cardBottomY - 50; ty += 46) {
    for (let tx = cardX + 22; tx < cardX + cardWidth - 28; tx += 52) {
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + triSide / 2, ty - triHeight);
      ctx.lineTo(tx + triSide, ty);
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();

  // ---------------------------------------------------------------------------
  // 5. DEEP NAVY PILL BANNER ON YELLOW CARD
  // ---------------------------------------------------------------------------
  const pillWidth = 470;
  const pillHeight = 32;
  const pillX = (width - pillWidth) / 2;
  const pillY = 222;

  ctx.fillStyle = '#0a1a3b';
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 16);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 12px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    isReceipt ? 'OFFICE COPY  •  FEE PAYMENT ACKNOWLEDGEMENT' : 'STUDENT COPY  •  FEE DUE REMINDER SLIP',
    width / 2,
    pillY + 20
  );

  // ---------------------------------------------------------------------------
  // 6. INSTITUTIONAL DAShed FIELD LINES
  // ---------------------------------------------------------------------------
  const leftX = 36;
  const rightBoundaryX = width - 36;

  const drawDashedRow = (label: string, value: string, rightNote: string, yPos: number, isAmount = false) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0a1a3b';
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.fillText(label, leftX, yPos);

    const labelMetrics = ctx.measureText(label);
    const valueStartX = leftX + labelMetrics.width + 10;

    ctx.fillStyle = '#0a1a3b';
    ctx.font = isAmount
      ? '900 16px "Courier New", monospace'
      : 'bold 11.5px system-ui, -apple-system, sans-serif';
    ctx.fillText(value, valueStartX, yPos);

    if (rightNote) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#0a1a3b';
      ctx.font = 'bold 9.5px system-ui, -apple-system, sans-serif';
      ctx.fillText(rightNote, rightBoundaryX, yPos);
    }

    // Dashed underline
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(10, 26, 59, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftX, yPos + 6);
    ctx.lineTo(rightBoundaryX, yPos + 6);
    ctx.stroke();
    ctx.restore();
  };

  // Field 1: Name
  const rollDetails = `Roll #: ${slip.roll_number || 'N/A'}  •  Adm #: ${slip.admission_number || 'N/A'}`;
  drawDashedRow('Name:', slip.student_name, rollDetails, 286);

  // Field 2: Class & Batch / Guardian
  const classBatchStr = [slip.program_name, slip.batch_name].filter(Boolean).join(' - ') || 'Active Course';
  drawDashedRow('Class & Batch:', classBatchStr, `Guardian: ${slip.father_name || 'Guardian'}`, 324);

  // Field 3: Amount
  const amountNumber = isReceipt ? slip.paid_amount : slip.balance_due;
  const amountStr = `PKR ${amountNumber.toLocaleString()}`;
  const concessionNote = slip.discount_amount && slip.discount_amount > 0
    ? `(Concession / Waiver: PKR ${slip.discount_amount.toLocaleString()})`
    : (isReceipt ? `Remaining Balance: PKR ${slip.balance_due.toLocaleString()}` : `Total Billed: PKR ${slip.gross_amount.toLocaleString()}`);
  drawDashedRow(isReceipt ? 'Amount Received:' : 'Net Amount Due:', amountStr, concessionNote, 362, true);

  // Field 4: In words
  const wordsText = numberToWords(amountNumber);
  drawDashedRow('In word:', wordsText, '', 400);

  // Field 5: On account of
  const rawFeeNames = (slip.items && slip.items.length > 0)
    ? slip.items.map(it => it.head_name).join(', ')
    : 'Monthly Tuition & Educational Charges';
  const feeHeadNames = rawFeeNames.length > 50 ? rawFeeNames.slice(0, 48) + '...' : rawFeeNames;
  drawDashedRow('On account of:', feeHeadNames, 'Itemized Below', 438);

  // ---------------------------------------------------------------------------
  // 7. ITEMIZED PARTICULAR BREAKDOWN TABLE (INSIDE YELLOW CARD)
  // ---------------------------------------------------------------------------
  const displayItems = (slip.items && slip.items.length > 0)
    ? slip.items.slice(0, 5)
    : [{ head_name: 'Academic Tuition Fee', amount: slip.gross_amount, allocated_amount: slip.paid_amount, balance_due: slip.balance_due }];

  const rowH = 22;
  const tableHeaderH = 24;
  const tableFooterH = 30;
  const tableH = tableHeaderH + (displayItems.length * rowH) + tableFooterH;
  const tableX = 34;
  const tableY = 458;
  const tableW = width - 68;

  // Crisp White Card for Table
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(tableX, tableY, tableW, tableH, 8);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Table Navy Header
  ctx.fillStyle = '#0a1a3b';
  ctx.beginPath();
  ctx.roundRect(tableX, tableY, tableW, tableHeaderH, [8, 8, 0, 0]);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SR', tableX + 12, tableY + 16);
  ctx.fillText('FEE PARTICULAR / HEAD', tableX + 44, tableY + 16);
  ctx.textAlign = 'right';
  ctx.fillText('BILLED (PKR)', tableX + tableW - 130, tableY + 16);
  ctx.fillText(isReceipt ? 'PAID / ALLOCATED' : 'BALANCE DUE', tableX + tableW - 14, tableY + 16);

  let curY = tableY + tableHeaderH;

  displayItems.forEach((it, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    ctx.fillRect(tableX, curY, tableW, rowH);

    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.strokeRect(tableX, curY, tableW, rowH);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 8.5px system-ui, sans-serif';
    ctx.fillText(`${idx + 1}.`, tableX + 12, curY + 15);

    ctx.fillStyle = '#0a1a3b';
    ctx.font = '600 9.5px system-ui, sans-serif';
    ctx.fillText(it.head_name, tableX + 44, curY + 15);

    ctx.textAlign = 'right';
    ctx.font = '600 9.5px "Courier New", monospace';
    ctx.fillStyle = '#475569';
    ctx.fillText(Number(it.amount || 0).toLocaleString(), tableX + tableW - 130, curY + 15);

    const rightAmt = isReceipt
      ? (it.allocated_amount != null ? it.allocated_amount : it.paid_amount || it.amount)
      : (it.balance_due != null ? it.balance_due : it.amount);

    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.fillStyle = isReceipt ? '#059669' : '#dc2626';
    ctx.fillText(Number(rightAmt || 0).toLocaleString(), tableX + tableW - 14, curY + 15);

    curY += rowH;
  });

  // Table Summary Footer Strip
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(tableX, tableY + tableH - tableFooterH, tableW, tableFooterH);
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(tableX, tableY + tableH - tableFooterH);
  ctx.lineTo(tableX + tableW, tableY + tableH - tableFooterH);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0a1a3b';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.fillText(`Net Billed: PKR ${slip.gross_amount.toLocaleString()}`, tableX + 12, tableY + tableH - 11);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#059669';
  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.fillText(`TOTAL PAID: PKR ${slip.paid_amount.toLocaleString()}`, tableX + tableW / 2 + 50, tableY + tableH - 11);

  ctx.fillStyle = slip.balance_due > 0 ? '#b91c1c' : '#059669';
  ctx.fillText(`BALANCE: PKR ${slip.balance_due.toLocaleString()}`, tableX + tableW - 14, tableY + tableH - 11);

  // ---------------------------------------------------------------------------
  // 8. PAYMENT METHOD RADIO CIRCLES & AUTHORIZED SIGNATURE (BOTTOM OF CARD)
  // ---------------------------------------------------------------------------
  const footerSecY = Math.max(684, tableY + tableH + 18);

  // Left Side: Payment Method / Deposit Channel Radio Circles
  const drawRadio = (x: number, y: number, label: string, isChecked: boolean) => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0a1a3b';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (isChecked) {
      ctx.fillStyle = '#0a1a3b';
      ctx.beginPath();
      ctx.arc(x, y, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0a1a3b';
    ctx.font = 'bold 8.5px system-ui, -apple-system, sans-serif';
    ctx.fillText(label, x + 10, y + 3);
  };

  const methodNorm = (slip.payment_method || 'cash').toLowerCase();
  drawRadio(40, footerSecY + 8, 'CASH', isReceipt ? methodNorm === 'cash' : true);
  drawRadio(120, footerSecY + 8, 'BANK IBFT', isReceipt ? (methodNorm === 'bank_transfer' || methodNorm === 'bank') : false);
  drawRadio(40, footerSecY + 30, 'EASYPAISA', isReceipt ? (methodNorm === 'easypaisa' || methodNorm === 'wallet') : false);
  drawRadio(120, footerSecY + 30, isReceipt ? 'CHEQUE' : 'RAAST', isReceipt ? methodNorm === 'cheque' : false);

  // Cashier Desk / Deposit note below radio circles
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0a1a3b';
  ctx.font = '600 8.5px system-ui, -apple-system, sans-serif';
  if (isReceipt) {
    ctx.fillText(`Cashier: ${slip.collected_by || 'Accounts Counter'}`, 40, footerSecY + 54);
  } else {
    const bankDisplay = academy.bank_name
      ? `Bank: ${academy.bank_name}${academy.account_number ? ` (A/C: ${academy.account_number})` : ''}`
      : 'Designated Campus Cashier / Accounts Counter';
    ctx.fillText(bankDisplay, 40, footerSecY + 54);
  }

  // Right Side: Authorized Signature Line & Verification Stamp
  const sigLineX = 350;
  const sigLineWidth = 190;
  const sigY = footerSecY + 38;

  ctx.strokeStyle = '#0a1a3b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sigLineX, sigY);
  ctx.lineTo(sigLineX + sigLineWidth, sigY);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0a1a3b';
  ctx.font = 'bold 9.5px system-ui, -apple-system, sans-serif';
  ctx.fillText('Authorized Signature / Cashier', sigLineX + sigLineWidth / 2, sigY + 16);

  // Official Institutional Stamp Graphic Seal
  const sealX = sigLineX + sigLineWidth / 2;
  const sealY = footerSecY + 6;
  ctx.save();
  ctx.strokeStyle = 'rgba(10, 26, 59, 0.45)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(sealX, sealY, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sealX, sealY, 17, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(10, 26, 59, 0.7)';
  ctx.font = 'bold 6px system-ui, sans-serif';
  const sealName = (academy.name || 'ACADEMY').toUpperCase().slice(0, 16);
  ctx.fillText(sealName, sealX, sealY - 6);
  ctx.font = 'bold 7px system-ui, sans-serif';
  ctx.fillText(isReceipt ? 'VERIFIED' : 'OFFICIAL', sealX, sealY + 2);
  ctx.font = 'bold 5.5px system-ui, sans-serif';
  ctx.fillText(new Date().getFullYear().toString(), sealX, sealY + 10);
  ctx.restore();

  // ---------------------------------------------------------------------------
  // 9. BOTTOM STRIP: CONTACT & DISCRETE "POWERED BY KAMPUS.PK" WITH LOGO
  // ---------------------------------------------------------------------------
  const kampusLogo = await loadImage('/kampus-logo.png');
  const bottomY = height - 22;

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 8px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${academy.name || 'Academy'} ERP • Generated on ${new Date().toLocaleDateString('en-GB')}`, 28, bottomY);

  if (kampusLogo) {
    const logoHeight = 11;
    const logoWidth = (kampusLogo.width / kampusLogo.height) * logoHeight;
    const textLabel = 'Powered by ';
    ctx.font = '500 8.5px system-ui, -apple-system, sans-serif';
    const textMetrics = ctx.measureText(textLabel);
    const totalBlockWidth = textMetrics.width + logoWidth + 4;
    const blockStartX = width - 36 - totalBlockWidth;

    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText(textLabel, blockStartX, bottomY);
    ctx.drawImage(kampusLogo, blockStartX + textMetrics.width + 2, bottomY - 9, logoWidth, logoHeight);
  } else {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Powered by kampus.pk', width - 36, bottomY);
  }

  return canvas;
}

/**
 * Converts canvas to PNG Blob
 */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas to Blob conversion failed'));
    }, 'image/png', 1.0);
  });
}

/**
 * Generate A6 Vertical Fee Slip/Receipt Picture, copy to clipboard, and trigger browser download
 */
export async function copyAndDownloadFeeSlip(
  slip: FeeSlipData,
  academy: AcademyInfo
): Promise<{ copiedToClipboard: boolean; downloaded: boolean; fileName: string; dataUrl: string }> {
  const canvas = await renderFeeSlipCanvas(slip, academy);
  const blob = await canvasToBlob(canvas);
  const dataUrl = canvas.toDataURL('image/png');

  const safeRoll = (slip.roll_number || slip.student_name || 'student').replace(/[^a-zA-Z0-9_-]/g, '_');
  const prefix = slip.slip_type === 'payment_receipt' ? 'Receipt' : 'Fee_Due_Slip';
  const idStr = (slip.receipt_number || slip.invoice_number || 'slip').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${prefix}_${idStr}_${safeRoll}.png`;

  // 1. Download file automatically
  let downloaded = false;
  try {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    downloaded = true;
  } catch (err) {
    console.warn('Auto download failed:', err);
  }

  // 2. Attempt clipboard copy (Supported in modern browsers via ClipboardItem)
  let copiedToClipboard = false;
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      copiedToClipboard = true;
    }
  } catch (err) {
    console.warn('Clipboard image write not permitted by browser context:', err);
  }

  return { copiedToClipboard, downloaded, fileName, dataUrl };
}

/**
 * Format official payment receipt message for WhatsApp
 */
export function formatWhatsAppPaymentReceiptText(
  slip: FeeSlipData,
  academy: AcademyInfo
): string {
  const lines: string[] = [
    `*FEE PAYMENT ACKNOWLEDGEMENT & OFFICIAL RECEIPT*`,
    `Institution: ${academy.name}`,
    ``,
    `Respected Parent / Guardian,`,
    `Fee payment for *${slip.student_name}* (Roll No: ${slip.roll_number || 'N/A'}) has been successfully received and credited to the student ledger.`,
    ``,
    `*Receipt Particulars:*`,
    `• Receipt Number: *${slip.receipt_number || 'REC-CONFIRMED'}*`,
    `• Challan / Invoice No: ${slip.invoice_number}`,
    `• Billing Month: ${slip.billing_month}`,
    `• Amount Paid: *PKR ${slip.paid_amount.toLocaleString()}*`,
    `• Payment Method: ${(slip.payment_method || 'CASH').toUpperCase()}`,
    `• Remaining Balance: *PKR ${slip.balance_due.toLocaleString()}*`,
    `• Cashier / Desk: ${slip.collected_by || 'Accounts Department'}`,
    ``,
    `_Note: Official A6 picture payment receipt is attached with this message. Retain it for your official records._`,
    ``,
    `Thank you for your prompt cooperation,`,
    `Accounts Department, ${academy.name}`
  ];

  return lines.join('\n');
}

/**
 * Format official fee reminder text message for WhatsApp
 */
export function formatWhatsAppFeeReminderText(
  slip: FeeSlipData,
  academy: AcademyInfo
): string {
  const lines: string[] = [
    `*ACADEMY FEE DUE REMINDER*`,
    `Institution: ${academy.name}`,
    ``,
    `Respected Parent / Guardian,`,
    `This is a gentle reminder regarding the educational fee dues for *${slip.student_name}* (Roll No: ${slip.roll_number || 'N/A'}).`,
    ``,
    `*Billing Details:*`,
    `• Month: ${slip.billing_month}`,
    `• Invoice / Challan No: ${slip.invoice_number}`,
    `• Outstanding Balance: *PKR ${slip.balance_due.toLocaleString()}*`,
    `• Due Date: *${slip.due_date || 'Prompt'}*`,
    ``,
    `*Payment Deposit Channels:*`,
    ...(academy.bank_name ? [`• Bank: ${academy.bank_name}${academy.account_number ? ` (${academy.account_number})` : ''}`] : []),
    ...(academy.easypaisa_number || academy.phone ? [`• EasyPaisa / JazzCash / Raast: ${academy.easypaisa_number || academy.phone}`] : [`• Authorized Campus Cashier Desk`]),
    ``,
    `_Note: Official A6 picture fee slip is attached. After depositing, kindly share payment screenshot with student roll number._`,
    ``,
    `Thank you,`,
    `Accounts Department, ${academy.name}`
  ];

  return lines.join('\n');
}

/**
 * 1-Click WhatsApp Picture Slip Dispatcher (Receipt or Due Reminder)
 * ZERO WhatsApp API: Generates A6 picture slip, copies to clipboard, downloads PNG,
 * and opens https://wa.me/ with pre-encoded text.
 */
export async function dispatchWhatsAppFeeSlipWithPicture(
  slip: FeeSlipData,
  academy: AcademyInfo,
  phoneOverride?: string
): Promise<{ copiedToClipboard: boolean; downloaded: boolean; fileName: string; waUrl: string }> {
  // 1. Generate slip image, copy to clipboard & auto-download
  const { copiedToClipboard, downloaded, fileName } = await copyAndDownloadFeeSlip(slip, academy);

  // 2. Resolve clean phone number
  const rawPhone = phoneOverride || slip.guardian_phone || '';
  const digits = rawPhone.replace(/\D/g, '');
  let cleanPhone = digits;
  if (digits.startsWith('0') && digits.length === 11) {
    cleanPhone = '92' + digits.slice(1);
  } else if (!digits.startsWith('92') && digits.length === 10) {
    cleanPhone = '92' + digits;
  }

  // 3. Format message & build wa.me URL
  const messageText = slip.slip_type === 'payment_receipt'
    ? formatWhatsAppPaymentReceiptText(slip, academy)
    : formatWhatsAppFeeReminderText(slip, academy);

  const encodedText = encodeURIComponent(messageText);
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  // 4. Open WhatsApp in new tab
  window.open(waUrl, '_blank', 'noopener,noreferrer');

  return { copiedToClipboard, downloaded, fileName, waUrl };
}
