import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  CreditCard,
  Building2
} from 'lucide-react';
import { Student, Batch, AcademicProgram } from '@apex/shared-types';
import { StudentIDCardItem } from './StudentIDCardItem';

interface StudentIDCardModalProps {
  student: Student;
  batch?: Batch | null;
  program?: AcademicProgram | null;
  academyName?: string;
  campusPhone?: string;
  campusAddress?: string;
  onClose: () => void;
}

export const StudentIDCardModal: React.FC<StudentIDCardModalProps> = ({
  student,
  batch,
  program,
  academyName = 'Apex Academy',
  campusPhone = '+92 42 35889000',
  campusAddress = 'Main Campus, Gulberg III, Lahore',
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'both' | 'front' | 'back'>('both');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-id-card-area, #printable-id-card-area * {
            visibility: visible;
          }
          #printable-id-card-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10mm;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: auto;
            margin: 5mm;
          }
        }
      `}</style>

      <div className="bg-white border border-slate-300 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col my-auto print:border-none print:shadow-none print:bg-white print:max-w-none">
        {/* Header Toolbar */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 no-print">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-slate-900 text-white shadow-xs">
              <CreditCard className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Student Identity Card (CR-80)</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-200 text-slate-700 font-semibold">
                  Official Record
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                {student.full_name} • Roll: <strong className="font-mono text-slate-700">{student.roll_number}</strong> • Adm: <span className="font-mono">{student.admission_number}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="bg-slate-200/80 p-1 rounded-xl flex items-center gap-1 border border-slate-300 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('both')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'both' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Front & Back
              </button>
              <button
                type="button"
                onClick={() => setViewMode('front')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'front' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Front Only
              </button>
              <button
                type="button"
                onClick={() => setViewMode('back')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'back' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Back Only
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Card</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Card Area */}
        <div id="printable-id-card-area" className="p-8 bg-slate-100/60 flex flex-col items-center justify-center min-h-[320px] print:p-0 print:bg-white">
          <StudentIDCardItem
            student={student}
            batch={batch}
            program={program}
            academyName={academyName}
            campusPhone={campusPhone}
            campusAddress={campusAddress}
            side={viewMode}
          />
        </div>

        {/* Modal Institutional Footer */}
        <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500 no-print">
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>ISO/IEC 7810 ID-1 standard format (85.6mm × 53.98mm). Printable to standard CR-80 PVC cards or A4 paper.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
