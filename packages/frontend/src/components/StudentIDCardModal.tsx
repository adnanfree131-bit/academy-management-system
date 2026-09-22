import React, { useState, useMemo } from 'react';
import { 
  X, 
  Printer, 
  CreditCard, 
  Building2,
  GraduationCap
} from 'lucide-react';
import { Student, Batch, AcademicProgram, StudentEnrollment } from '@apex/shared-types';
import { StudentIDCardItem } from './StudentIDCardItem';
import { useMobileOverlay } from '../lib/mobileOverlay';

export interface StudentIDCardModalProps {
  student: Student;
  batch?: Batch | null;
  program?: AcademicProgram | null;
  batches?: Batch[];
  programs?: AcademicProgram[];
  enrollments?: StudentEnrollment[];
  initialEnrollmentId?: string;
  academyName?: string;
  campusPhone?: string;
  campusAddress?: string;
  onClose: () => void;
}

export const StudentIDCardModal: React.FC<StudentIDCardModalProps> = ({
  student,
  batch,
  program,
  batches = [],
  programs = [],
  enrollments = [],
  initialEnrollmentId,
  academyName = 'Academy',
  campusPhone = '+92 42 35889000',
  campusAddress = 'Main Campus',
  onClose,
}) => {
  useMobileOverlay('sheet', true, onClose);
  const [viewMode, setViewMode] = useState<'both' | 'front' | 'back'>('both');

  // Filter to active / on-leave enrollments, or all if none active
  const availableEnrollments = useMemo(() => {
    if (!enrollments || enrollments.length === 0) return [];
    const activeList = enrollments.filter(e => e.status === 'active' || e.status === 'on_leave');
    return activeList.length > 0 ? activeList : enrollments;
  }, [enrollments]);

  // Selected enrollment state
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>(() => {
    if (initialEnrollmentId) return initialEnrollmentId;
    if (availableEnrollments.length > 0) {
      const primary = availableEnrollments.find(e => e.is_primary);
      return primary ? primary.id : availableEnrollments[0].id;
    }
    return '';
  });

  const selectedEnrollment = useMemo(() => {
    return enrollments.find(e => e.id === selectedEnrollmentId) || null;
  }, [enrollments, selectedEnrollmentId]);

  // Derive effective batch, program, and student for the selected class
  const effectiveBatch = useMemo(() => {
    if (selectedEnrollment && batches.length > 0) {
      const found = batches.find(b => b.id === selectedEnrollment.batch_id);
      if (found) return found;
    }
    return batch || null;
  }, [selectedEnrollment, batches, batch]);

  const effectiveProgram = useMemo(() => {
    const progId = effectiveBatch?.program_id || selectedEnrollment?.program_id;
    if (progId && programs.length > 0) {
      const found = programs.find(p => p.id === progId);
      if (found) return found;
    }
    return program || null;
  }, [effectiveBatch, selectedEnrollment, programs, program]);

  const effectiveStudent = useMemo((): Student => {
    if (!selectedEnrollment) return student;
    return {
      ...student,
      batch_id: selectedEnrollment.batch_id,
      program_id: selectedEnrollment.program_id || effectiveProgram?.id || student.program_id,
      roll_number: selectedEnrollment.roll_number || student.roll_number,
      subjects: selectedEnrollment.subjects && selectedEnrollment.subjects.length > 0
        ? selectedEnrollment.subjects
        : student.subjects,
    };
  }, [student, selectedEnrollment, effectiveProgram]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 print:p-0 print:bg-white print:static print:inset-auto mobile-sheet">
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

      <div className="bg-white border-t sm:border border-slate-300 rounded-t-3xl sm:rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-none print:border-none print:shadow-none print:bg-white print:max-w-none sm:zoom-in-95 duration-200 mobile-sheet-card">
        {/* Mobile Swipe Grab Handle Pill */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2.5 sm:hidden shrink-0 no-print" />

        {/* Header Toolbar */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50 no-print">
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
                {effectiveStudent.full_name} • Adm: <strong className="font-mono text-slate-700">{effectiveStudent.admission_number}</strong>
                {effectiveBatch && <span className="ml-1 text-slate-500">• {effectiveBatch.name}</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Class / Enrollment Selector if student attends multiple classes */}
            {availableEnrollments.length > 1 && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs shadow-2xs">
                <GraduationCap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <label htmlFor="id-card-class-select" className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Class:</label>
                <select
                  id="id-card-class-select"
                  value={selectedEnrollmentId}
                  onChange={e => setSelectedEnrollmentId(e.target.value)}
                  className="text-xs font-semibold text-slate-800 bg-transparent outline-none cursor-pointer pr-1"
                >
                  {availableEnrollments.map(enr => {
                    const b = batches.find(x => x.id === enr.batch_id);
                    const prog = programs.find(p => p.id === (enr.program_id || b?.program_id));
                    const label = b?.name || prog?.name || 'Class Enrollment';
                    const primaryTag = enr.is_primary ? ' (Primary)' : '';
                    return (
                      <option key={enr.id} value={enr.id}>
                        {label}{primaryTag}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="bg-slate-200/80 p-1 rounded-xl flex items-center gap-1 border border-slate-300 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('both')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'both' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Front & Back
              </button>
              <button
                type="button"
                onClick={() => setViewMode('front')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'front' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Front Only
              </button>
              <button
                type="button"
                onClick={() => setViewMode('back')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'back' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Back Only
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Card</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Card Area */}
        <div id="printable-id-card-area" className="p-2 sm:p-8 overflow-x-auto bg-slate-100/60 flex flex-col items-center justify-center min-h-[320px] print:p-0 print:bg-white">
          <StudentIDCardItem
            student={effectiveStudent}
            batch={effectiveBatch}
            program={effectiveProgram}
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
            className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
