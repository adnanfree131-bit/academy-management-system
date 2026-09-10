import { PDFDocument, RGB, rgb, StandardFonts } from 'pdf-lib';
import { Student, Batch, AcademicProgram } from '@apex/shared-types';

const MM = 2.83465;
const CARD_W = 85.6 * MM;
const CARD_H = 53.98 * MM;
const NAVY: RGB = rgb(0.06, 0.09, 0.16);
const SLATE: RGB = rgb(0.29, 0.33, 0.39);
const INK: RGB = rgb(0.06, 0.09, 0.16);


export interface IdCardPdfInput {
  student: Student;
  batch?: Batch | null;
  program?: AcademicProgram | null;
  academyName: string;
  campusName?: string;
  campusPhone?: string | null;
  logoBytes?: Uint8Array | null;
  logoMime?: string | null;
  validUntil: string;
}

async function embedLogo(doc: PDFDocument, bytes?: Uint8Array | null, mime?: string | null) {
  if (!bytes || bytes.length < 16) return null;
  try {
    if (mime?.includes('png') || bytes[0] === 0x89) return await doc.embedPng(bytes);
    return await doc.embedJpg(bytes);
  } catch {
    try {
      return await doc.embedPng(bytes);
    } catch {
      return null;
    }
  }
}

export async function buildStudentIdCardPdf(cards: IdCardPdfInput[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const card of cards) {
    const logo = await embedLogo(doc, card.logoBytes, card.logoMime);
    const photoBytes = await fetchDataUrlBytes(card.student.photo_url);
    const photo = photoBytes ? await embedLogo(doc, photoBytes.bytes, photoBytes.mime) : null;

    const front = doc.addPage([CARD_W, CARD_H]);
    front.drawRectangle({ x: 0, y: 0, width: CARD_W, height: CARD_H, color: rgb(1, 1, 1) });
    front.drawRectangle({ x: 0, y: CARD_H - 16, width: CARD_W, height: 16, color: NAVY });
    if (logo) {
      front.drawRectangle({ x: 4, y: CARD_H - 14.5, width: 11, height: 11, color: rgb(1, 1, 1) });
      const dim = logo.scaleToFit(10, 10);
      front.drawImage(logo, { x: 4.5, y: CARD_H - 14, width: dim.width, height: dim.height });
    }
    front.drawText(truncate(card.academyName.toUpperCase(), 42), {
      x: 18, y: CARD_H - 10, size: 6.2, font: fontBold, color: rgb(1, 1, 1),
    });
    front.drawText('STUDENT IDENTITY CARD', {
      x: 18, y: CARD_H - 14.5, size: 4.2, font, color: rgb(0.85, 0.88, 0.92),
    });

    front.drawRectangle({ x: 0, y: CARD_H - 22, width: CARD_W, height: 6, color: rgb(0.96, 0.97, 0.98) });
    front.drawText('Official campus credential', {
      x: 6, y: CARD_H - 20.5, size: 4.4, font: fontBold, color: SLATE,
    });
    const session = card.batch?.academic_session || '';
    if (session) {
      front.drawText(session, {
        x: CARD_W - 6 - font.widthOfTextAtSize(session, 4.4),
        y: CARD_H - 20.5, size: 4.4, font, color: SLATE,
      });
    }

    front.drawRectangle({ x: 6, y: 16, width: 28, height: CARD_H - 42, color: rgb(0.96, 0.97, 0.98) });
    if (photo) {
      const fit = photo.scaleToFit(26, CARD_H - 44);
      front.drawImage(photo, { x: 7, y: 17, width: fit.width, height: fit.height });
    } else {
      front.drawText('PHOTO', { x: 12.5, y: 36, size: 5, font: fontBold, color: SLATE });
    }

    const rows: [string, string][] = [
      ['Name', card.student.full_name || '—'],
      ['Roll No', card.student.roll_number || '—'],
      ['Admission', card.student.admission_number || '—'],
      ['Class', card.program?.name || '—'],
      ['Batch', card.batch?.name || '—'],
      ['Guardian', card.student.guardian_name || '—'],
    ];
    let y = CARD_H - 30;
    for (const [label, value] of rows) {
      front.drawText(label.toUpperCase(), { x: 38, y, size: 3.6, font: fontBold, color: SLATE });
      front.drawText(truncate(value, 28), { x: 38, y: y - 6, size: 5.4, font: fontBold, color: INK });
      y -= 12;
    }

    front.drawRectangle({ x: 0, y: 0, width: CARD_W, height: 12, color: rgb(0.97, 0.98, 0.99) });
    front.drawText(`Valid until  ${card.validUntil}`, {
      x: 6, y: 5, size: 4.2, font, color: SLATE,
    });
    front.drawText('Registrar', {
      x: CARD_W - 28, y: 5, size: 4.2, font, color: SLATE,
    });

    const back = doc.addPage([CARD_W, CARD_H]);
    back.drawRectangle({ x: 0, y: 0, width: CARD_W, height: CARD_H, color: rgb(1, 1, 1) });
    back.drawRectangle({ x: 0, y: CARD_H - 14, width: CARD_W, height: 14, color: NAVY });
    back.drawText('RULES & EMERGENCY', {
      x: 6, y: CARD_H - 9, size: 6, font: fontBold, color: rgb(1, 1, 1),
    });
    const phone = card.student.guardian_phone || '—';
    const campusPhone = card.campusPhone || '—';
    const info = [
      `Guardian phone: ${phone}`,
      `Campus: ${card.campusName || 'Main Campus'}`,
      campusPhone !== '—' ? `Helpline: ${campusPhone}` : '',
      '1. Produce this card at campus entry and examinations.',
      `2. Non-transferable. Property of ${card.academyName}.`,
      '3. If found, return to Campus Administration.',
    ].filter(Boolean);
    let by = CARD_H - 24;
    for (const text of info) {
      back.drawText(truncate(text, 62), { x: 6, y: by, size: 5, font, color: INK });
      by -= 8;
    }
    back.drawRectangle({ x: 0, y: 0, width: CARD_W, height: 10, color: rgb(0.97, 0.98, 0.99) });
    back.drawText(truncate(card.campusName || card.academyName, 50), {
      x: 6, y: 3.5, size: 4.2, font, color: SLATE,
    });
  }

  return doc.save();
}

function truncate(value: string, max: number): string {
  const v = (value || '').trim();
  if (v.length <= max) return v;
  return `${v.slice(0, max - 1)}…`;
}

async function fetchDataUrlBytes(src?: string | null): Promise<{ bytes: Uint8Array; mime: string } | null> {
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
    const buf = new Uint8Array(await res.arrayBuffer());
    const mime = res.headers.get('content-type') || 'image/png';
    return { bytes: buf, mime };
  } catch {
    return null;
  }
}

export async function fetchLogoBytes(src?: string | null): Promise<{ bytes: Uint8Array; mime: string } | null> {
  return fetchDataUrlBytes(src);
}
