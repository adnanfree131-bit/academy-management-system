import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Printer, 
  Search, 
  CheckSquare, 
  Square,
  CreditCard,
  Sliders,
  X
} from 'lucide-react';
import { Student, Batch, AcademicProgram } from '@apex/shared-types';
import { SectionInfo } from '../components/SectionInfo';
import { StudentIDCardItem, computeCardValidUntil } from '../components/StudentIDCardItem';
import { InstitutionalLoader } from '../components/InstitutionalLoader';
import { buildStudentIdCardPdf, fetchLogoBytes } from '../lib/idCardPdf';

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
  const [isLoading, setIsLoading] = useState(!propStudents);

  const students = propStudents || internalStudents;
  const batches = propBatches || internalBatches;
  const programs = propPrograms || internalPrograms;

  // Filters & Selection
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
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
        s.admission_number.toLowerCase().includes(q);
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

  const getBatch = (batchId?: string | null) => (batchId ? batches.find(b => b.id === batchId) : undefined);
  const getProgram = (progId?: string | null) => (progId ? programs.find(p => p.id === progId) : undefined);

  // Split selected students into chunks of 8 for A4 Duplex pages
  const duplexChunks = useMemo(() => {
    const chunks: Student[][] = [];
    for (let i = 0; i < activeSelectedStudents.length; i += 8) {
      chunks.push(activeSelectedStudents.slice(i, i + 8));
    }
    return chunks;
  }, [activeSelectedStudents]);

  const [isExporting, setIsExporting] = useState(false);

  const handlePrint = async () => {
    if (activeSelectedStudents.length === 0) return;
    setIsExporting(true);
    try {
      const logo = await fetchLogoBytes(tenant?.logo_url || null);
      const bytes = await buildStudentIdCardPdf(
        activeSelectedStudents.map(student => ({
          student,
          batch: getBatch(student.batch_id),
          program: getProgram(student.program_id),
          academyName: tenant?.name || 'Academy',
          campusName: tenant?.campus_name,
          campusPhone: tenant?.phone || null,
          logoBytes: logo?.bytes || null,
          logoMime: logo?.mime || null,
          validUntil: computeCardValidUntil(getBatch(student.batch_id)),
        }))
      );
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(tenant?.slug || 'academy')}-student-id-cards.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('ID card PDF failed', err);
    } finally {
      setIsExporting(false);
    }
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
            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 shrink-0 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-slate-700" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Student ID Cards
                </h3>
                <SectionInfo text="Generate ISO/IEC 7810 ID-1 standard CR-80 cards with institutional credentials and verification QR codes." />
              </div>
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
              disabled={activeSelectedStudents.length === 0 || isExporting}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Preparing…' : `Print Cards (${activeSelectedStudents.length})`}</span>
            </button>
          </div>
        </div>

        {/* Standalone Search Bar & Mobile Filter Toggle */}
        <div className="flex items-center gap-2 pt-1">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by student name or admission #..."
              className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Filter Toggle */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`sm:hidden w-9 h-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center relative transition-colors shadow-2xs shrink-0 cursor-pointer ${
              showFilters ? 'border-primary-500 bg-primary-50/30' : ''
            }`}
            title="Filters & Layout"
            aria-label="Filters & Layout"
          >
            <Sliders className="w-4 h-4 text-slate-600" />
            {((selectedProgramId !== 'all' ? 1 : 0) + (selectedBatchId !== 'all' ? 1 : 0) + (printLayout !== 'a4-duplex-8' ? 1 : 0)) > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
            )}
          </button>
        </div>

        {/* Filter Controls Row (Always on sm+, collapsible on mobile) */}
        <div className={`${showFilters ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1 border-t border-slate-100 sm:border-t-0`}>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Program Filter */}
            <select
              value={selectedProgramId}
              onChange={e => setSelectedProgramId(e.target.value)}
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">All Academic Programs</option>
              {programs.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Batch Filter */}
            <select
              value={selectedBatchId}
              onChange={e => setSelectedBatchId(e.target.value)}
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-slate-900"
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
              className={`flex-1 sm:flex-initial px-2.5 py-1 rounded font-medium text-[11px] transition-all ${
                printLayout === 'a4-duplex-8' 
                  ? 'bg-white text-slate-900 font-semibold shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="8 cards per A4 sheet (Fronts on Page 1, Inverted Backs on Page 2 for double-sided flip)"
            >
              8 Cards/A4
            </button>
            <button
              type="button"
              onClick={() => setPrintLayout('a4-foldable-4')}
              className={`flex-1 sm:flex-initial px-2.5 py-1 rounded font-medium text-[11px] transition-all ${
                printLayout === 'a4-foldable-4' 
                  ? 'bg-white text-slate-900 font-semibold shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="4 pairs per A4 sheet with Front & Back side-by-side to fold in half"
            >
              4 Pairs/A4
            </button>
            <button
              type="button"
              onClick={() => setPrintLayout('thermal-pvc')}
              className={`flex-1 sm:flex-initial px-2.5 py-1 rounded font-medium text-[11px] transition-all ${
                printLayout === 'thermal-pvc' 
                  ? 'bg-white text-slate-900 font-semibold shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Single card per page for PVC card printers"
            >
              PVC Card
            </button>
          </div>
        </div>

        {/* Selection Statistics & Toggles */}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={selectAllFiltered}
              className="text-slate-800 hover:underline font-semibold flex items-center gap-1.5"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Select All Filtered ({filteredStudents.length})</span>
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={deselectAll}
              className="text-slate-500 hover:text-slate-800 hover:underline font-medium"
            >
              Clear Selection
            </button>
          </div>

          <div className="font-mono text-slate-600 text-xs">
            {isLoading ? (
              <span className="text-slate-400">Loading roster...</span>
            ) : (
              <>
                <span className="font-semibold text-slate-900">{activeSelectedStudents.length}</span> of {students.length} students selected
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Screen: Split View (Student Checklist on Left, Live Card Preview on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 no-print">
        {/* Left Column: Student Roster Checklist (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-3 shadow-xs space-y-2 max-h-[620px] overflow-y-auto">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1 pb-1 border-b border-slate-100 flex justify-between">
            <span>Student Roster ({isLoading ? '…' : filteredStudents.length})</span>
            <span>Status</span>
          </div>

          {isLoading ? (
            <InstitutionalLoader variant="inline" label="Loading student cards roster..." />
          ) : filteredStudents.length === 0 ? (
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

                      <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center font-medium text-[10px] shrink-0">
                        {student.full_name.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <h4 className="font-semibold text-xs text-slate-900 truncate">{student.full_name}</h4>
                        <div className="text-[10.5px] text-slate-500 font-mono flex items-center gap-1.5 truncate">
                          <span>Adm: {student.admission_number}</span>
                          <span>•</span>
                          <span className="truncate">{batch?.name || 'Section'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {student.id_card_reprint_required && (
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                          Reprint Needed
                        </span>
                      )}
                      {student.blood_group ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {student.blood_group}
                        </span>
                      ) : null}
                    </div>
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
            {isLoading ? (
              <InstitutionalLoader variant="page" label="Loading identity card preview..." />
            ) : activeSelectedStudents.length === 0 ? (
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
                      academyLogoUrl={tenant?.logo_url}
                      campusPhone={tenant?.phone ?? null}
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
                      academyLogoUrl={tenant?.logo_url}
                      campusPhone={tenant?.phone ?? null}
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
                      academyLogoUrl={tenant?.logo_url}
                      campusPhone={tenant?.phone ?? null}
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
