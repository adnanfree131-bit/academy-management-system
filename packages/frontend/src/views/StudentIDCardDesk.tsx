import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Printer, 
  Search, 
  CheckSquare, 
  Square,
  CreditCard
} from 'lucide-react';
import { Student, Batch, AcademicProgram } from '@apex/shared-types';
import { StudentIDCardItem } from '../components/StudentIDCardItem';

export interface StudentIDCardDeskProps {
  students?: Student[];
  batches?: Batch[];
  programs?: AcademicProgram[];
  initialSelectedIds?: string[];
  onBackToDirectory?: () => void;
}

export const StudentIDCardDesk: React.FC<StudentIDCardDeskProps> = ({
  students: propStudents,
  batches: propBatches,
  programs: propPrograms,
  initialSelectedIds,
  onBackToDirectory,
}) => {
  const { token, tenant } = useAuth();
  const [internalStudents, setInternalStudents] = useState<Student[]>([]);
  const [internalBatches, setInternalBatches] = useState<Batch[]>([]);
  const [internalPrograms, setInternalPrograms] = useState<AcademicProgram[]>([]);
  const [_isLoading, setIsLoading] = useState(false);

  const students = propStudents || internalStudents;
  const batches = propBatches || internalBatches;
  const programs = propPrograms || internalPrograms;

  // Filters & Selection
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    new Set(initialSelectedIds || [])
  );

  // Layout mode: 'a4-duplex-8' | 'a4-foldable-4' | 'thermal-pvc'
  const [printLayout, setPrintLayout] = useState<'a4-duplex-8' | 'a4-foldable-4' | 'thermal-pvc'>('a4-duplex-8');

  // Preview tab in on-screen UI: 'both' | 'front' | 'back'
  const [previewSide, setPreviewSide] = useState<'both' | 'front' | 'back'>('both');

  // Fetch only if props were not provided
  useEffect(() => {
    if (propStudents && propBatches && propPrograms) return;
    if (!token) return;

    let isMounted = true;
    setIsLoading(true);
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch('/api/v1/sis/students', { headers }).then(r => r.json()),
      fetch('/api/v1/academic/batches', { headers }).then(r => r.json()),
      fetch('/api/v1/academic/programs', { headers }).then(r => r.json()),
    ])
      .then(([sData, bData, pData]) => {
        if (!isMounted) return;
        if (sData.success) {
          setInternalStudents(sData.data);
          if (!initialSelectedIds || initialSelectedIds.length === 0) {
            setSelectedStudentIds(new Set(sData.data.slice(0, 8).map((s: Student) => s.id)));
          }
        }
        if (bData.success) setInternalBatches(bData.data);
        if (pData.success) setInternalPrograms(pData.data);
      })
      .catch(err => {
        console.error('Error fetching data for ID card desk:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, propStudents, propBatches, propPrograms, initialSelectedIds]);

  // Update selection if initialSelectedIds changes
  useEffect(() => {
    if (initialSelectedIds && initialSelectedIds.length > 0) {
      setSelectedStudentIds(new Set(initialSelectedIds));
    }
  }, [initialSelectedIds]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || 
        s.full_name.toLowerCase().includes(q) ||
        s.admission_number.toLowerCase().includes(q) ||
        s.roll_number.toLowerCase().includes(q);
      const matchesBatch = selectedBatchId === 'all' || s.batch_id === selectedBatchId;
      const matchesProg = selectedProgramId === 'all' || s.program_id === selectedProgramId;
      return matchesQuery && matchesBatch && matchesProg;
    });
  }, [students, searchQuery, selectedBatchId, selectedProgramId]);

  // Selected Student Objects
  const activeSelectedStudents = useMemo(() => {
    return students.filter(s => selectedStudentIds.has(s.id));
  }, [students, selectedStudentIds]);

  const toggleStudent = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudentIds(next);
  };

  const selectAllFiltered = () => {
    const next = new Set(selectedStudentIds);
    filteredStudents.forEach(s => next.add(s.id));
    setSelectedStudentIds(next);
  };

  const deselectAll = () => {
    setSelectedStudentIds(new Set());
  };

  const getBatch = (batchId: string) => batches.find(b => b.id === batchId);
  const getProgram = (progId: string) => programs.find(p => p.id === progId);

  // Split selected students into chunks of 8 for A4 Duplex pages
  const duplexChunks = useMemo(() => {
    const chunks: Student[][] = [];
    for (let i = 0; i < activeSelectedStudents.length; i += 8) {
      chunks.push(activeSelectedStudents.slice(i, i + 8));
    }
    return chunks;
  }, [activeSelectedStudents]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Print stylesheet */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #bulk-id-card-print-area, #bulk-id-card-print-area * {
            visibility: visible;
          }
          #bulk-id-card-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-after: always;
            break-after: page;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          .cr80-card {
            border: 1px solid #94a3b8 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* Control Header & Filters Bar (Hidden on Print) */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs space-y-3 no-print">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-slate-900 text-white shadow-xs">
              <CreditCard className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Student ID Card Generator & Printing Desk
              </h3>
              <p className="text-xs text-slate-500">
                Generate ISO/IEC 7810 ID-1 standard CR-80 cards with institutional credentials and verification QR codes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onBackToDirectory && (
              <button
                type="button"
                onClick={onBackToDirectory}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Back to Directory
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              disabled={activeSelectedStudents.length === 0}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print {activeSelectedStudents.length} Selected Cards</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search student, roll #, admission #..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-sans"
              />
            </div>

            {/* Program Filter */}
            <select
              value={selectedProgramId}
              onChange={e => setSelectedProgramId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">All Academic Programs</option>
              {programs.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>

            {/* Batch Filter */}
            <select
              value={selectedBatchId}
              onChange={e => setSelectedBatchId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">All Sections / Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.shift})</option>
              ))}
            </select>
          </div>

          {/* Layout Mode Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setPrintLayout('a4-duplex-8')}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                printLayout === 'a4-duplex-8' 
                  ? 'bg-white text-slate-900 font-bold shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="8 cards per A4 sheet (Fronts on Page 1, Inverted Backs on Page 2 for double-sided flip)"
            >
              8 Cards/A4 (Duplex)
            </button>
            <button
              type="button"
              onClick={() => setPrintLayout('a4-foldable-4')}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                printLayout === 'a4-foldable-4' 
                  ? 'bg-white text-slate-900 font-bold shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="4 pairs per A4 sheet with Front & Back side-by-side to fold in half"
            >
              4 Pairs/A4 (Foldable)
            </button>
            <button
              type="button"
              onClick={() => setPrintLayout('thermal-pvc')}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                printLayout === 'thermal-pvc' 
                  ? 'bg-white text-slate-900 font-bold shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Single card per page for PVC card printers"
            >
              Single PVC Card
            </button>
          </div>
        </div>

        {/* Selection Statistics & Toggles */}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={selectAllFiltered}
              className="text-slate-800 hover:underline font-bold flex items-center gap-1.5"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Select All Filtered ({filteredStudents.length})</span>
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={deselectAll}
              className="text-slate-500 hover:text-slate-800 hover:underline"
            >
              Clear Selection
            </button>
          </div>

          <div className="font-mono text-slate-600 text-xs">
            <strong>{activeSelectedStudents.length}</strong> of {students.length} students selected
          </div>
        </div>
      </div>

      {/* Main Screen: Split View (Student Checklist on Left, Live Card Preview on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 no-print">
        {/* Left Column: Student Roster Checklist (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2 max-h-[620px] overflow-y-auto">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1 pb-1 border-b border-slate-100 flex justify-between">
            <span>Student Roster ({filteredStudents.length})</span>
            <span>Status</span>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No students match the selected filter criteria.
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredStudents.map(student => {
                const isSelected = selectedStudentIds.has(student.id);
                const batch = getBatch(student.batch_id);

                return (
                  <div
                    key={student.id}
                    onClick={() => toggleStudent(student.id)}
                    className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between gap-2.5 ${
                      isSelected 
                        ? 'bg-slate-50 border-slate-400 shadow-xs' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          toggleStudent(student.id);
                        }}
                        className="text-slate-900 shrink-0"
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4 text-slate-900" /> : <Square className="w-4 h-4 text-slate-300" />}
                      </button>

                      <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                        {student.full_name.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <h4 className="font-bold text-xs text-slate-900 truncate">{student.full_name}</h4>
                        <div className="text-[10.5px] text-slate-500 font-mono flex items-center gap-1.5 truncate">
                          <span>Roll: {student.roll_number}</span>
                          <span>•</span>
                          <span className="truncate">{batch?.name || 'Section'}</span>
                        </div>
                      </div>
                    </div>

                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                      {student.blood_group || 'O+'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Live Institutional Card Preview (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h4 className="text-xs font-bold text-slate-900">
                Card Preview ({activeSelectedStudents.length} selected)
              </h4>
              <p className="text-[11px] text-slate-500">
                Displaying high-fidelity CR-80 card specimen conforming to ISO/IEC 7810.
              </p>
            </div>

            <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex items-center gap-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPreviewSide('both')}
                className={`px-2 py-0.5 rounded transition-all ${
                  previewSide === 'both' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Front & Back
              </button>
              <button
                type="button"
                onClick={() => setPreviewSide('front')}
                className={`px-2 py-0.5 rounded transition-all ${
                  previewSide === 'front' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Front
              </button>
              <button
                type="button"
                onClick={() => setPreviewSide('back')}
                className={`px-2 py-0.5 rounded transition-all ${
                  previewSide === 'back' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Back
              </button>
            </div>
          </div>

          <div className="flex-1 bg-slate-50/80 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center min-h-[380px] max-h-[550px] overflow-y-auto">
            {activeSelectedStudents.length === 0 ? (
              <div className="text-center space-y-2 py-12">
                <CreditCard className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500">
                  Select one or more students from the roster on the left to preview their identity cards.
                </p>
              </div>
            ) : (
              <div className="space-y-6 w-full flex flex-col items-center">
                {activeSelectedStudents.slice(0, 3).map(student => (
                  <div key={student.id} className="w-full flex flex-col items-center space-y-2">
                    <StudentIDCardItem
                      student={student}
                      batch={getBatch(student.batch_id)}
                      program={getProgram(student.program_id)}
                      academyName={tenant?.name}
                      campusAddress={tenant?.campus_name}
                      side={previewSide}
                    />
                    <div className="text-[10px] font-mono text-slate-400">
                      Card specimen for {student.full_name} ({student.admission_number})
                    </div>
                  </div>
                ))}
                {activeSelectedStudents.length > 3 && (
                  <div className="text-xs text-slate-500 font-medium pt-2 text-center">
                    + {activeSelectedStudents.length - 3} more student cards selected for printing.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* PRINTABLE AREA FOR PHYSICAL CARDS                                    */}
      {/* =================================================================== */}
      <div id="bulk-id-card-print-area">
        {/* LAYOUT 1: A4 DUPLEX 8 CARDS PER PAGE (2 COLS X 4 ROWS) */}
        {printLayout === 'a4-duplex-8' && duplexChunks.map((chunk, chunkIndex) => {
          return (
            <React.Fragment key={chunkIndex}>
              {/* Sheet 1: 8 Fronts */}
              <div className="p-4 bg-white min-h-[1050px] flex flex-col justify-between page-break">
                <div className="text-[9px] text-slate-400 font-mono pb-1 border-b border-slate-200 flex justify-between uppercase">
                  <span>{tenant?.name || 'Academy'} — STUDENT ID CARDS (FRONT SHEET {chunkIndex + 1})</span>
                  <span>GRID: 2×4 CR-80 SPECIFICATION</span>
                </div>

                <div className="grid grid-cols-2 gap-3 py-3 my-auto justify-items-center">
                  {chunk.map(student => (
                    <StudentIDCardItem
                      key={student.id}
                      student={student}
                      batch={getBatch(student.batch_id)}
                      program={getProgram(student.program_id)}
                      academyName={tenant?.name}
                      campusAddress={tenant?.campus_name}
                      side="front"
                    />
                  ))}
                </div>

                <div className="text-center text-[8.5px] text-slate-400 pt-1 border-t border-slate-200">
                  Cut along outer card borders. In duplex printing, flip along long edge for exact alignment.
                </div>
              </div>

              {/* Sheet 2: 8 Backs (Horizontally swapped columns so long-edge duplex alignment matches) */}
              <div className="p-4 bg-white min-h-[1050px] flex flex-col justify-between page-break">
                <div className="text-[9px] text-slate-400 font-mono pb-1 border-b border-slate-200 flex justify-between uppercase">
                  <span>{tenant?.name || 'Academy'} — STUDENT ID CARDS (BACK SHEET {chunkIndex + 1})</span>
                  <span>ALIGNMENT: HORIZONTALLY INVERTED DUPLEX FLIP</span>
                </div>

                <div className="grid grid-cols-2 gap-3 py-3 my-auto justify-items-center">
                  {Array.from({ length: Math.ceil(chunk.length / 2) }).flatMap((_, rowIdx) => {
                    const idx1 = rowIdx * 2;
                    const idx2 = rowIdx * 2 + 1;
                    const pair = [];
                    if (chunk[idx2]) pair.push(chunk[idx2]);
                    if (chunk[idx1]) pair.push(chunk[idx1]);
                    return pair;
                  }).map(student => (
                    <StudentIDCardItem
                      key={student.id}
                      student={student}
                      batch={getBatch(student.batch_id)}
                      program={getProgram(student.program_id)}
                      academyName={tenant?.name}
                      campusAddress={tenant?.campus_name}
                      side="back"
                    />
                  ))}
                </div>

                <div className="text-center text-[8.5px] text-slate-400 pt-1 border-t border-slate-200">
                  Page 2 (Back) aligns directly with Page 1 (Front) upon standard two-sided printing.
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* LAYOUT 2: 4 PAIRS PER A4 (FOLDABLE) */}
        {printLayout === 'a4-foldable-4' && (
          <div className="p-4 bg-white space-y-6">
            {Array.from({ length: Math.ceil(activeSelectedStudents.length / 4) }).map((_, pageIdx) => {
              const pageStudents = activeSelectedStudents.slice(pageIdx * 4, pageIdx * 4 + 4);
              return (
                <div key={pageIdx} className="min-h-[1050px] p-4 flex flex-col justify-between page-break">
                  <div className="text-[9px] text-slate-400 font-mono pb-1 border-b border-slate-200 flex justify-between uppercase">
                    <span>{tenant?.name || 'Academy'} — FOLDABLE ID CARDS (PAGE {pageIdx + 1})</span>
                    <span>FOLD ALONG CENTER VERTICAL LINE & LAMINATE</span>
                  </div>

                  <div className="space-y-4 my-auto flex flex-col items-center">
                    {pageStudents.map(student => (
                      <div key={student.id} className="flex items-center border border-dashed border-slate-300 rounded-xl overflow-hidden p-1">
                        <StudentIDCardItem
                          student={student}
                          batch={getBatch(student.batch_id)}
                          program={getProgram(student.program_id)}
                          academyName={tenant?.name}
                          campusAddress={tenant?.campus_name}
                          side="front"
                        />
                        <div className="w-[1px] h-full border-r border-dashed border-slate-400 mx-2" />
                        <StudentIDCardItem
                          student={student}
                          batch={getBatch(student.batch_id)}
                          program={getProgram(student.program_id)}
                          academyName={tenant?.name}
                          campusAddress={tenant?.campus_name}
                          side="back"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="text-center text-[8.5px] text-slate-400 pt-1 border-t border-slate-200">
                    Cut along perimeter and fold down center vertical seam for standard lamination pouch.
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* LAYOUT 3: THERMAL PVC (SINGLE CARD PER PAGE) */}
        {printLayout === 'thermal-pvc' && (
          <div className="p-0 bg-white">
            {activeSelectedStudents.map(student => (
              <React.Fragment key={student.id}>
                {/* Front */}
                <div className="page-break flex items-center justify-center p-0 m-0 w-[85.6mm] h-[54mm]">
                  <StudentIDCardItem
                    student={student}
                    batch={getBatch(student.batch_id)}
                    program={getProgram(student.program_id)}
                    academyName={tenant?.name}
                    campusAddress={tenant?.campus_name}
                    side="front"
                  />
                </div>
                {/* Back */}
                <div className="page-break flex items-center justify-center p-0 m-0 w-[85.6mm] h-[54mm]">
                  <StudentIDCardItem
                    student={student}
                    batch={getBatch(student.batch_id)}
                    program={getProgram(student.program_id)}
                    academyName={tenant?.name}
                    campusAddress={tenant?.campus_name}
                    side="back"
                  />
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
