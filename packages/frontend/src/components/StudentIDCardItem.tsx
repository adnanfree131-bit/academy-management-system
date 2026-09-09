import React from 'react';
import { Building2, User } from 'lucide-react';
import { Student, Batch, AcademicProgram } from '@apex/shared-types';
import { QRCodeSVG } from '../lib/qrCode';

export interface StudentIDCardItemProps {
  student: Student;
  batch?: Batch | null;
  program?: AcademicProgram | null;
  academyName?: string;
  campusPhone?: string;
  campusAddress?: string;
  validUntil?: string;
  side?: 'front' | 'back' | 'both';
  className?: string;
}

/**
 * Authentic Institutional CR-80 Student ID Card
 * Standard ISO/IEC 7810 ID-1 PVC dimensions (85.6mm x 53.98mm)
 * Strict Zero AI Slop: White card stock, deep navy institutional header,
 * tabular data, scannable QR code, official terms, no subjects, no neon gradients.
 */
export const StudentIDCardItem: React.FC<StudentIDCardItemProps> = ({
  student,
  batch,
  program,
  academyName = 'Academy',
  campusPhone = '+92 42 35889000',
  campusAddress = 'Main Campus',
  validUntil = '30-JUN-2027',
  side = 'both',
  className = '',
}) => {
  const qrData = JSON.stringify({
    institution: academyName,
    id: student.id,
    adm: student.admission_number,
    roll: student.roll_number,
    name: student.full_name,
    batch: batch?.name || 'Standard Batch',
    valid_until: validUntil,
  });

  const renderFront = () => (
    <div className="cr80-card w-[325px] h-[205px] sm:w-[340px] sm:h-[215px] bg-white text-slate-900 rounded-xl border border-slate-300 shadow-sm flex flex-col justify-between overflow-hidden relative select-none print:shadow-none print:border-slate-400 print:w-[85.6mm] print:h-[54mm] print:rounded-none">
      {/* 1. Official Institutional Navy Header */}
      <div className="bg-[#0f172a] text-white px-3 py-1.5 flex items-center gap-2 border-b border-amber-500/80 shrink-0">
        <div className="w-6 h-6 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
          <Building2 className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <h4 className="font-extrabold text-[10.5px] uppercase tracking-tight text-white truncate">
            {academyName}
          </h4>
          <span className="text-[7.5px] font-medium text-slate-300 tracking-wider uppercase block truncate">
            Campus Registration & Identity Division
          </span>
        </div>
      </div>

      {/* 2. Sub-header Strip */}
      <div className="bg-slate-100/90 border-b border-slate-200 px-3 py-0.5 flex items-center justify-between text-[8px] font-bold text-slate-700 uppercase tracking-wider shrink-0">
        <span>Student Identity Card</span>
        <span className="font-mono text-slate-600">Session {batch?.academic_session || '2026–2027'}</span>
      </div>

      {/* 3. Middle Section: Photo & Particulars */}
      <div className="px-3 py-1.5 flex-1 flex items-center gap-3">
        {/* Photo Box: 3:4 Standard Ratio */}
        <div className="flex flex-col items-center shrink-0">
          <div className="w-[66px] h-[82px] sm:w-[72px] sm:h-[90px] rounded-md bg-slate-100 border border-slate-300 overflow-hidden flex flex-col items-center justify-center relative p-0.5 bg-white">
            {student.photo_url ? (
              <img
                src={student.photo_url}
                alt={student.full_name}
                className="w-full h-full object-cover rounded-xs"
              />
            ) : (
              <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-400">
                <User className="w-6 h-6 text-slate-400 mb-0.5" />
                <span className="text-[7px] font-mono uppercase font-bold text-slate-400">PHOTO</span>
              </div>
            )}
          </div>
          <div className="mt-1 text-[7.5px] font-bold text-slate-600 tracking-tight">
            BLOOD: <span className="font-mono font-extrabold text-red-700">{student.blood_group || 'O+'}</span>
          </div>
        </div>

        {/* Tabular Student Particulars */}
        <div className="flex-1 min-w-0 flex flex-col justify-center space-y-0.5">
          <div className="border-b border-slate-200 pb-0.5 mb-0.5">
            <h3 className="font-extrabold text-[12px] sm:text-[13px] text-slate-900 tracking-tight uppercase leading-tight truncate">
              {student.full_name}
            </h3>
          </div>

          <table className="w-full text-left text-[8.5px] border-collapse leading-tight">
            <tbody>
              <tr>
                <td className="text-slate-500 font-semibold w-16 py-0.5">Roll No:</td>
                <td className="font-mono font-bold text-slate-900 py-0.5">{student.roll_number}</td>
              </tr>
              <tr>
                <td className="text-slate-500 font-semibold py-0.5">Reg/Adm:</td>
                <td className="font-mono font-semibold text-slate-700 py-0.5">{student.admission_number}</td>
              </tr>
              <tr>
                <td className="text-slate-500 font-semibold py-0.5">Class:</td>
                <td className="font-bold text-slate-800 truncate py-0.5 max-w-[140px]">
                  {program?.name || 'Class 10'}
                </td>
              </tr>
              <tr>
                <td className="text-slate-500 font-semibold py-0.5">Section:</td>
                <td className="font-medium text-slate-700 truncate py-0.5 max-w-[140px]">
                  {batch?.name || 'Section A'} {batch?.shift ? `(${batch.shift})` : ''}
                </td>
              </tr>
              <tr>
                <td className="text-slate-500 font-semibold py-0.5">Father:</td>
                <td className="font-medium text-slate-700 truncate py-0.5 max-w-[140px]">
                  {student.guardian_name || '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Official Card Footer */}
      <div className="bg-slate-50 border-t border-slate-200 px-3 py-1 flex items-end justify-between text-[7.5px] text-slate-600 shrink-0">
        <div className="leading-tight">
          <span className="text-slate-400 block font-semibold text-[6.5px] uppercase">Card Validity</span>
          <span className="font-mono font-bold text-slate-800">{validUntil}</span>
        </div>
        <div className="text-right leading-tight">
          <div className="font-serif italic text-slate-800 text-[9px] border-b border-slate-300 pb-0.5 leading-none">
            Registrar Office
          </div>
          <span className="text-[6.5px] text-slate-500 font-semibold uppercase block mt-0.5">
            Authorized Signatory
          </span>
        </div>
      </div>
    </div>
  );

  const renderBack = () => (
    <div className="cr80-card w-[325px] h-[205px] sm:w-[340px] sm:h-[215px] bg-white text-slate-900 rounded-xl border border-slate-300 shadow-sm flex flex-col justify-between overflow-hidden relative select-none print:shadow-none print:border-slate-400 print:w-[85.6mm] print:h-[54mm] print:rounded-none">
      {/* 1. Header Strip */}
      <div className="bg-[#0f172a] text-white px-3 py-1.5 flex items-center justify-between border-b border-slate-700 shrink-0">
        <span className="font-extrabold text-[8.5px] uppercase tracking-wider text-slate-100">
          Rules & Emergency Directory
        </span>
        <span className="font-mono text-[7px] text-slate-400 uppercase">
          UID: {student.id.slice(0, 8)}
        </span>
      </div>

      {/* 2. Middle Section */}
      <div className="px-3 py-1.5 flex-1 flex items-start gap-3 text-[8px] leading-tight">
        {/* QR Code */}
        <div className="flex flex-col items-center justify-center p-1 bg-white border border-slate-200 rounded-md shrink-0">
          <QRCodeSVG value={qrData} size={62} />
          <span className="text-[6.5px] font-bold text-slate-600 uppercase tracking-tighter mt-0.5">
            VERIFY ID
          </span>
        </div>

        {/* Information & Regulations */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Emergency contacts */}
          <div className="bg-slate-50 border border-slate-200 rounded-md p-1.5 space-y-0.5">
            <div className="flex justify-between items-center text-[8px]">
              <span className="text-slate-500 font-semibold">Guardian Phone:</span>
              <strong className="font-mono text-slate-900 font-bold">{student.guardian_phone}</strong>
            </div>
            <div className="flex justify-between items-center text-[8px]">
              <span className="text-slate-500 font-semibold">Campus Helpline:</span>
              <strong className="font-mono text-slate-800">{campusPhone}</strong>
            </div>
          </div>

          {/* Institutional Regulations */}
          <div className="text-[7.5px] text-slate-600 space-y-0.5 leading-tight">
            <p className="font-bold text-slate-800 uppercase text-[7px] tracking-wide">
              Institutional Regulations:
            </p>
            <p>1. Card must be visibly produced upon campus entry & examinations.</p>
            <p>2. Non-transferable; property of {academyName}.</p>
            <p>3. If found, please return to the Campus Administration Office.</p>
          </div>
        </div>
      </div>

      {/* 3. Official Campus Address Footer */}
      <div className="bg-slate-50 border-t border-slate-200 px-3 py-1 text-center text-[7px] text-slate-500 shrink-0">
        <span className="font-semibold text-slate-700 block truncate">{campusAddress}</span>
        <span className="text-[6.5px] text-slate-400">Official Institutional Credential</span>
      </div>
    </div>
  );

  if (side === 'front') {
    return <div className={`cr80-card-wrapper inline-block ${className}`}>{renderFront()}</div>;
  }
  if (side === 'back') {
    return <div className={`cr80-card-wrapper inline-block ${className}`}>{renderBack()}</div>;
  }

  return (
    <div className={`cr80-card-duplex-wrapper flex flex-wrap items-center justify-center gap-4 ${className}`}>
      {renderFront()}
      {renderBack()}
    </div>
  );
};
