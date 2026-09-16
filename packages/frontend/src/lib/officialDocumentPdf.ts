import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';

const A4: [number, number] = [595.28, 841.89];
const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
export const MARGIN = 24;
const NAVY = rgb(0.06, 0.09, 0.16);
const SLATE = rgb(0.35, 0.39, 0.45);
const RULE = rgb(0.86, 0.88, 0.91);
const INK = rgb(0.07, 0.09, 0.15);

export interface AcademyLetterhead {
  name: string;
  campus?: string;
  session?: string;
  phone?: string | null;
  domain?: string | null;
  logoBytes?: Uint8Array | null;
  logoMime?: string | null;
}

export interface PdfTableColumn {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'right';
}

export async function createOfficialDocument(title: string, academy: AcademyLetterhead, opts?: { landscape?: boolean }) {
  const doc = await PDFDocument.create();
  const pageSize = opts?.landscape ? A4_LANDSCAPE : A4;
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  let logo = null as Awaited<ReturnType<PDFDocument['embedPng']>> | null;
  if (academy.logoBytes && academy.logoBytes.length > 16) {
    try {
      logo = academy.logoMime?.includes('jpg') || academy.logoMime?.includes('jpeg')
        ? await doc.embedJpg(academy.logoBytes)
        : await doc.embedPng(academy.logoBytes);
    } catch {
      try { logo = await doc.embedPng(academy.logoBytes); } catch { logo = null; }
    }
  }

  const addPage = () => {
    const page = doc.addPage(pageSize);
    const { width, height } = page.getSize();
    page.drawRectangle({ x: 0, y: height - 56, width, height: 56, color: NAVY });
    if (logo) {
      page.drawRectangle({ x: MARGIN, y: height - 48, width: 32, height: 32, color: rgb(1, 1, 1) });
      const fit = logo.scaleToFit(28, 28);
      page.drawImage(logo, { x: MARGIN + 2, y: height - 46, width: fit.width, height: fit.height });
    }
    const textX = logo ? MARGIN + 40 : MARGIN;
    page.drawText(academy.name, { x: textX, y: height - 24, size: 13, font: fontBold, color: rgb(1, 1, 1) });
    const sub = [academy.campus, academy.session, academy.phone].filter(Boolean).join('  ·  ');
    if (sub) page.drawText(sub, { x: textX, y: height - 38, size: 8, font, color: rgb(0.85, 0.88, 0.92) });
    page.drawText(title.toUpperCase(), { x: textX, y: height - 50, size: 8, font: fontBold, color: rgb(0.75, 0.80, 0.86) });
    page.drawText(new Date().toLocaleDateString('en-GB'), { x: width - MARGIN - 70, y: height - 28, size: 8, font, color: rgb(0.85, 0.88, 0.92) });
    page.drawRectangle({ x: 0, y: 0, width, height: 22, color: NAVY });
    page.drawText('Official computer-generated document', {
      x: MARGIN, y: 8, size: 7, font, color: rgb(0.85, 0.88, 0.92),
    });
    return page;
  };

  return { doc, font, fontBold, addPage, width: pageSize[0], height: pageSize[1] };
}

export function drawKeyValue(
  page: PDFPage,
  _font: PDFFont,
  fontBold: PDFFont,
  x: number,
  y: number,
  label: string,
  value: string,
) {
  page.drawText(label.toUpperCase(), { x, y, size: 7, font: fontBold, color: SLATE });
  page.drawText(value || '—', { x, y: y - 12, size: 10, font: fontBold, color: INK });
}

export function drawTable(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  startY: number,
  columns: PdfTableColumn[],
  rows: Record<string, string>[],
) {
  const x0 = MARGIN;
  let y = startY;
  page.drawRectangle({ x: x0, y: y - 4, width: columns.reduce((s, c) => s + c.width, 0), height: 16, color: rgb(0.96, 0.97, 0.98) });
  let x = x0;
  for (const col of columns) {
    page.drawText(col.label.toUpperCase(), { x: x + 4, y: y, size: 7, font: fontBold, color: SLATE });
    x += col.width;
  }
  y -= 18;
  for (const row of rows) {
    if (y < 50) break;
    x = x0;
    page.drawLine({ start: { x: x0, y: y + 10 }, end: { x: x0 + columns.reduce((s, c) => s + c.width, 0), y: y + 10 }, thickness: 0.4, color: RULE });
    for (const col of columns) {
      const text = (row[col.key] || '—').slice(0, 42);
      const tw = font.widthOfTextAtSize(text, 8);
      const tx = col.align === 'right' ? x + col.width - 6 - tw : x + 4;
      page.drawText(text, { x: tx, y, size: 8, font, color: INK });
      x += col.width;
    }
    y -= 16;
  }
  return y;
}

export async function downloadPdfBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchLogoBytes(src?: string | null) {
  if (!src) return null;
  try {
    if (src.startsWith('data:')) {
      const [meta, b64] = src.split(',');
      const mime = meta.slice(5, meta.indexOf(';')) || 'image/png';
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return { bytes, mime };
    }
    const res = await fetch(src);
    if (!res.ok) return null;
    return { bytes: new Uint8Array(await res.arrayBuffer()), mime: res.headers.get('content-type') || 'image/png' };
  } catch {
    return null;
  }
}

export function letterheadFromTenant(tenant: {
  name?: string;
  campus_name?: string;
  academic_session?: string;
  phone?: string | null;
  domain?: string | null;
} | null, logo?: { bytes: Uint8Array; mime: string } | null): AcademyLetterhead {
  return {
    name: tenant?.name || 'Academy',
    campus: tenant?.campus_name,
    session: tenant?.academic_session,
    phone: tenant?.phone,
    domain: tenant?.domain,
    logoBytes: logo?.bytes || null,
    logoMime: logo?.mime || null,
  };
}

export async function academyLetterheadFromAuth(tenant: {
  name?: string;
  campus_name?: string;
  academic_session?: string;
  phone?: string | null;
  domain?: string | null;
  logo_url?: string | null;
} | null): Promise<AcademyLetterhead> {
  const logo = await fetchLogoBytes(tenant?.logo_url || null);
  return letterheadFromTenant(tenant, logo);
}

export async function buildSimpleStatementPdf(opts: {
  title: string;
  academy: AcademyLetterhead;
  identity: { label: string; value: string }[];
  columns: PdfTableColumn[];
  rows: Record<string, string>[];
  footerNote?: string;
}): Promise<Uint8Array> {
  const { doc, font, fontBold, addPage, height } = await createOfficialDocument(opts.title, opts.academy);
  const page = addPage();
  let y = height - 100;
  let x = MARGIN;
  opts.identity.forEach((item, i) => {
    if (i > 0 && i % 3 === 0) {
      y -= 28;
      x = MARGIN;
    }
    drawKeyValue(page, font, fontBold, x, y, item.label, item.value);
    x += 170;
  });
  y -= 36;
  drawTable(page, font, fontBold, y, opts.columns, opts.rows);
  if (opts.footerNote) {
    page.drawText(opts.footerNote, { x: MARGIN, y: 42, size: 8, font, color: SLATE });
  }
  return doc.save();
}
