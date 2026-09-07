import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  GraduationCap,
  BookOpen,
  FileCheck2,
  FileSpreadsheet,
  Plus,
  Printer,
  Download,
  Upload,
  Search,
  CheckCircle2,
  Award,
  X,
  FolderTree,
  PenTool,
  MessageSquare,
  AlertCircle
} from 'lucide-react';
import {
  Exam,
  QuestionChapter,
  BankQuestion,
  StudentExamEvaluation,
  StudentOfficialReportCard,
  ExamQuestionType,
  Student,
  Batch,
  Subject,
  AcademicProgram
} from '@apex/shared-types';

export const ExamDeskView: React.FC = () => {
  const { tenant, token } = useAuth();

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'exams' | 'bank' | 'evaluate'>('exams');

  // Core Data States
  const [exams, setExams] = useState<Exam[]>([]);
  const [chapters, setChapters] = useState<QuestionChapter[]>([]);
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

  // Selected filters for Question Bank
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('all');
  const [questionTypeFilter, setQuestionTypeFilter] = useState<'ALL' | ExamQuestionType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateExamModal, setShowCreateExamModal] = useState(false);
  const [showPrintPaperModal, setShowPrintPaperModal] = useState(false);
  const [selectedExamForPaper, setSelectedExamForPaper] = useState<Exam | null>(null);
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [showReportCardModal, setShowReportCardModal] = useState(false);
  const [activeReportCard, setActiveReportCard] = useState<StudentOfficialReportCard | null>(null);

  // New Exam Form
  const [newExamBatchId, setNewExamBatchId] = useState('');
  const [newExamSubjectId, setNewExamSubjectId] = useState('');
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamDate, setNewExamDate] = useState(new Date().toISOString().split('T')[0]);
  const [newExamDuration, setNewExamDuration] = useState(60);
  const [newExamMcqCount, setNewExamMcqCount] = useState(10);
  const [newExamMcqMarksPerQ, setNewExamMcqMarksPerQ] = useState(1);
  const [newExamShortMarks, setNewExamShortMarks] = useState(20);
  const [newExamLongMarks, setNewExamLongMarks] = useState(20);
  const [newExamMcqLabel, setNewExamMcqLabel] = useState('Q.1 (Objective MCQs)');
  const [newExamShortLabel, setNewExamShortLabel] = useState('Q.2 (Short Questions)');
  const [newExamLongLabel, setNewExamLongLabel] = useState('Q.3 (Long Questions)');

  // New Bank Question Form
  const [newQSubjectId, setNewQSubjectId] = useState('');
  const [newQChapterId, setNewQChapterId] = useState('');
  const [newQType, setNewQType] = useState<ExamQuestionType>('MCQ');
  const [newQText, setNewQText] = useState('');
  const [newQMarks, setNewQMarks] = useState(1);
  const [newQOptionA, setNewQOptionA] = useState('');
  const [newQOptionB, setNewQOptionB] = useState('');
  const [newQOptionC, setNewQOptionC] = useState('');
  const [newQOptionD, setNewQOptionD] = useState('');
  const [newQCorrectOption, setNewQCorrectOption] = useState('A');
  const [newQRubric, setNewQRubric] = useState('');
  const [newQDifficulty, setNewQDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');

  // Excel Upload States (Flow A)
  const [excelTextRaw, setExcelTextRaw] = useState('');
  const [excelProgramId, setExcelProgramId] = useState('');
  const [excelSubjectId, setExcelSubjectId] = useState('');
  const [importSuccessMsg, setImportSuccessMsg] = useState('');

  // Hybrid Evaluation Desk State
  const [evalSelectedExamId, setEvalSelectedExamId] = useState('');
  const [evalSelectedStudentId, setEvalSelectedStudentId] = useState('');
  const [evalMcqAnswers, setEvalMcqAnswers] = useState<Record<string, string>>({});
  const [evalShortScore, setEvalShortScore] = useState<number>(0);
  const [evalShortRemarks, setEvalShortRemarks] = useState<string>('');
  const [evalLongScore, setEvalLongScore] = useState<number>(0);
  const [evalLongRemarks, setEvalLongRemarks] = useState<string>('');
  const [examEvaluations, setExamEvaluations] = useState<StudentExamEvaluation[]>([]);
  const [evalSaveSuccess, setEvalSaveSuccess] = useState('');

  // Fetch initial data
  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { authorization: `Bearer ${token}` };

      const [examsRes, chapRes, qRes, batchRes, subRes, progRes, studRes] = await Promise.all([
        fetch('/api/v1/exams', { headers }),
        fetch('/api/v1/exams/chapters', { headers }),
        fetch('/api/v1/exams/questions', { headers }),
        fetch('/api/v1/academic/batches', { headers }),
        fetch('/api/v1/academic/subjects', { headers }),
        fetch('/api/v1/academic/programs', { headers }),
        fetch('/api/v1/sis/students', { headers }),
      ]);

      if (examsRes.ok) {
        const d = await examsRes.json();
        setExams(d.data || []);
        if (d.data?.length > 0 && !evalSelectedExamId) {
          setEvalSelectedExamId(d.data[0].id);
        }
      }
      if (chapRes.ok) {
        const d = await chapRes.json();
        setChapters(d.data || []);
      }
      if (qRes.ok) {
        const d = await qRes.json();
        setBankQuestions(d.data || []);
      }
      if (batchRes.ok) {
        const d = await batchRes.json();
        setBatches(d.data || []);
        if (d.data?.length > 0 && !newExamBatchId) setNewExamBatchId(d.data[0].id);
      }
      if (subRes.ok) {
        const d = await subRes.json();
        setSubjects(d.data || []);
        if (d.data?.length > 0) {
          if (!selectedSubjectId) setSelectedSubjectId(d.data[0].id);
          if (!newExamSubjectId) setNewExamSubjectId(d.data[0].id);
          if (!newQSubjectId) setNewQSubjectId(d.data[0].id);
          if (!excelSubjectId) setExcelSubjectId(d.data[0].id);
        }
      }
      if (progRes.ok) {
        const d = await progRes.json();
        setPrograms(d.data || []);
        if (d.data?.length > 0 && !excelProgramId) setExcelProgramId(d.data[0].id);
      }
      if (studRes.ok) {
        const d = await studRes.json();
        setStudents(d.data || []);
        if (d.data?.length > 0 && !evalSelectedStudentId) {
          setEvalSelectedStudentId(d.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed loading exam data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Load evaluations when selected exam changes
  useEffect(() => {
    if (!evalSelectedExamId || !token) return;
    const fetchEvals = async () => {
      try {
        const res = await fetch(`/api/v1/exams/${evalSelectedExamId}/evaluations`, {
          headers: { authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const d = await res.json();
          setExamEvaluations(d.data || []);

          // If current student already evaluated, populate fields
          if (evalSelectedStudentId) {
            const existing = d.data?.find((ev: any) => ev.student_id === evalSelectedStudentId);
            if (existing) {
              setEvalMcqAnswers(existing.mcq_answers || {});
              setEvalShortScore(existing.short_score || 0);
              setEvalShortRemarks(existing.short_remarks || '');
              setEvalLongScore(existing.long_score || 0);
              setEvalLongRemarks(existing.long_remarks || '');
            } else {
              setEvalMcqAnswers({});
              setEvalShortScore(0);
              setEvalShortRemarks('');
              setEvalLongScore(0);
              setEvalLongRemarks('');
            }
          }
        }
      } catch (e) {
        console.error('Failed fetching evaluations:', e);
      }
    };
    fetchEvals();
  }, [evalSelectedExamId, evalSelectedStudentId, token]);

  // Active exam object for evaluation desk
  const currentExam = exams.find(e => e.id === evalSelectedExamId);
  const currentStudent = students.find(s => s.id === evalSelectedStudentId);

  // Compute live marks for evaluation desk
  const activeExamMcqs = currentExam?.questions?.filter(q => q.section_type === 'MCQ') || [];
  const autoCalculatedMcqScore = activeExamMcqs.reduce((acc, mcq) => {
    const chosen = evalMcqAnswers[mcq.id];
    if (chosen && mcq.correct_option && chosen.toUpperCase() === mcq.correct_option.toUpperCase()) {
      return acc + Number(mcq.marks || currentExam?.mcq_marks_per_q || 1);
    }
    return acc;
  }, 0);

  const totalCalculatedObtained = Number((autoCalculatedMcqScore + Number(evalShortScore || 0) + Number(evalLongScore || 0)).toFixed(2));
  const examTotalMarks = currentExam?.total_marks || 1;
  const calculatedPercentage = Number(((totalCalculatedObtained / examTotalMarks) * 100).toFixed(2));

  let derivedGrade = 'F';
  if (calculatedPercentage >= 90) derivedGrade = 'A*';
  else if (calculatedPercentage >= 80) derivedGrade = 'A';
  else if (calculatedPercentage >= 70) derivedGrade = 'B';
  else if (calculatedPercentage >= 60) derivedGrade = 'C';
  else if (calculatedPercentage >= 50) derivedGrade = 'D';
  else if (calculatedPercentage >= 40) derivedGrade = 'E';

  // Handle Save Evaluation
  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalSelectedExamId || !evalSelectedStudentId || !token) return;

    try {
      const res = await fetch(`/api/v1/exams/${evalSelectedExamId}/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          student_id: evalSelectedStudentId,
          mcq_answers: evalMcqAnswers,
          short_score: Number(evalShortScore),
          short_remarks: evalShortRemarks,
          long_score: Number(evalLongScore),
          long_remarks: evalLongRemarks,
          status: 'GRADED'
        })
      });

      if (res.ok) {
        const d = await res.json();
        setEvalSaveSuccess(`Evaluation saved for ${currentStudent?.full_name}: ${d.data.total_obtained} Marks (${d.data.grade})`);
        fetchData();
        // Refresh evaluations list
        const evRes = await fetch(`/api/v1/exams/${evalSelectedExamId}/evaluations`, {
          headers: { authorization: `Bearer ${token}` }
        });
        if (evRes.ok) {
          const evData = await evRes.json();
          setExamEvaluations(evData.data || []);
        }
      }
    } catch (err) {
      console.error('Failed to save evaluation:', err);
    }
  };

  // Handle Create Exam
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamBatchId || !newExamSubjectId || !newExamTitle || !token) return;

    const mcqTotal = newExamMcqCount * newExamMcqMarksPerQ;

    try {
      const res = await fetch('/api/v1/exams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          batch_id: newExamBatchId,
          subject_id: newExamSubjectId,
          title: newExamTitle,
          exam_date: newExamDate,
          duration_minutes: Number(newExamDuration),
          mcq_count: Number(newExamMcqCount),
          mcq_marks_per_q: Number(newExamMcqMarksPerQ),
          mcq_total_marks: mcqTotal,
          short_total_marks: Number(newExamShortMarks),
          long_total_marks: Number(newExamLongMarks),
          section_labels: {
            mcq: newExamMcqLabel,
            short: newExamShortLabel,
            long: newExamLongLabel
          },
          status: 'PUBLISHED'
        })
      });

      if (res.ok) {
        setShowCreateExamModal(false);
        fetchData();
      }
    } catch (err) {
      console.error('Failed creating exam:', err);
    }
  };

  // Handle Add Bank Question
  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQSubjectId || !newQText || !token) return;

    let options: Array<{ key: string; text: string }> = [];
    if (newQType === 'MCQ') {
      if (newQOptionA) options.push({ key: 'A', text: newQOptionA });
      if (newQOptionB) options.push({ key: 'B', text: newQOptionB });
      if (newQOptionC) options.push({ key: 'C', text: newQOptionC });
      if (newQOptionD) options.push({ key: 'D', text: newQOptionD });
    }

    try {
      const res = await fetch('/api/v1/exams/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          subject_id: newQSubjectId,
          chapter_id: newQChapterId || null,
          question_type: newQType,
          question_text: newQText,
          marks: Number(newQMarks),
          options: options.length > 0 ? options : undefined,
          correct_option: newQType === 'MCQ' ? newQCorrectOption : null,
          rubric_guide: newQRubric || null,
          difficulty_level: newQDifficulty,
          is_quiz_bank: true
        })
      });

      if (res.ok) {
        setShowAddQuestionModal(false);
        setNewQText('');
        fetchData();
      }
    } catch (err) {
      console.error('Failed adding question:', err);
    }
  };

  // Handle Flow A: Excel Chapter Upload
  const handleExcelImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelSubjectId || !excelProgramId || !excelTextRaw || !token) return;

    // Parse tab-separated or comma-separated rows
    // Expected format: ChapterNumber, ChapterName, Type, QuestionText, Marks, OptionA, OptionB, OptionC, OptionD, CorrectOption, Rubric
    const lines = excelTextRaw.trim().split('\n');
    const parsedRows = lines.map(line => {
      const parts = line.includes('\t') ? line.split('\t') : line.split(',');
      return {
        chapter_number: parseInt(parts[0]?.trim() || '1', 10),
        chapter_name: parts[1]?.trim() || 'General Chapter',
        question_type: (parts[2]?.trim().toUpperCase() || 'MCQ') as ExamQuestionType,
        question_text: parts[3]?.trim() || 'Sample question',
        marks: parseFloat(parts[4]?.trim() || '1'),
        option_a: parts[5]?.trim(),
        option_b: parts[6]?.trim(),
        option_c: parts[7]?.trim(),
        option_d: parts[8]?.trim(),
        correct_option: parts[9]?.trim().toUpperCase(),
        rubric_guide: parts[10]?.trim()
      };
    }).filter(r => r.question_text);

    try {
      const res = await fetch('/api/v1/exams/questions/import-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          subject_id: excelSubjectId,
          program_id: excelProgramId,
          rows: parsedRows
        })
      });

      if (res.ok) {
        const d = await res.json();
        setImportSuccessMsg(`Successfully imported ${d.data.imported_count} questions across ${d.data.chapters_created} chapters!`);
        setExcelTextRaw('');
        fetchData();
      }
    } catch (err) {
      console.error('Failed excel import:', err);
    }
  };

  // Open official report card
  const handleOpenReportCard = async (examId: string, studentId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/v1/exams/${examId}/report-card/${studentId}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setActiveReportCard(d.data);
        setShowReportCardModal(true);
      }
    } catch (err) {
      console.error('Failed opening report card:', err);
    }
  };

  // Filtered bank questions
  const filteredQuestions = bankQuestions.filter(q => {
    if (selectedSubjectId && q.subject_id !== selectedSubjectId) return false;
    if (selectedChapterId !== 'all' && q.chapter_id !== selectedChapterId) return false;
    if (questionTypeFilter !== 'ALL' && q.question_type !== questionTypeFilter) return false;
    if (searchQuery && !q.question_text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Fast Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <GraduationCap className="w-7 h-7 text-indigo-600" />
            Examination, Question Bank & Assessment Desk
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Dual question bank modes, Excel chapter upload, simple total marks exam setup, and hybrid auto-MCQs + question remarks grading.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {loading && (
            <span className="text-[11px] font-semibold text-slate-400 animate-pulse mr-2">
              Syncing...
            </span>
          )}
          <button
            onClick={() => setShowCreateExamModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" /> New Exam Setup
          </button>
          <button
            onClick={() => setShowExcelImportModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel Chapter Upload
          </button>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Scheduled Exams</span>
            <FileCheck2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{exams.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Active Academic Sessions</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Question Bank</span>
            <BookOpen className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{bankQuestions.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">MCQs, Short & Long Items</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Chapter Folders</span>
            <FolderTree className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{chapters.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Structured Chapter Tree</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase">
            <span>Evaluations Recorded</span>
            <Award className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{examEvaluations.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Auto-MCQ + Teacher Feedback</div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-3 gap-2">
        <button
          onClick={() => setActiveTab('exams')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'exams'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCheck2 className="w-4 h-4" />
          Scheduled Exams & Printable Papers
        </button>

        <button
          onClick={() => setActiveTab('bank')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'bank'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Dual Question Bank & Excel Upload
        </button>

        <button
          onClick={() => setActiveTab('evaluate')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'evaluate'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <PenTool className="w-4 h-4" />
          Hybrid Evaluation Desk & Question Remarks
        </button>
      </div>

      {/* TAB 1: SCHEDULED EXAMS & PRINTABLE PAPERS */}
      {activeTab === 'exams' && (
        <div className="bg-white p-6 rounded-b-xl border-x border-b border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Academic Exams & Tests Registry</h2>
              <p className="text-xs text-slate-500">Track assessment schedules, question allocations, and 1-click printable student test papers.</p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 uppercase text-[10px] font-bold text-slate-500">
                <tr>
                  <th className="py-3 px-4">Exam Title</th>
                  <th className="py-3 px-4">Batch & Subject</th>
                  <th className="py-3 px-4">Exam Date</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4 text-center">Marks Breakdown</th>
                  <th className="py-3 px-4 text-right">Total Marks</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {exams.map(exam => (
                  <tr key={exam.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {exam.title}
                      <span className="block text-[10px] font-mono text-slate-400 font-normal">ID: {exam.id}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{exam.subject_name || 'Physics'}</span>
                      <span className="block text-[10px] text-slate-500">{exam.batch_name || 'Batch A'}</span>
                    </td>
                    <td className="py-3 px-4">{exam.exam_date}</td>
                    <td className="py-3 px-4">{exam.duration_minutes} Mins</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold mr-1">
                        MCQs: {exam.mcq_total_marks || (exam.mcq_count * exam.mcq_marks_per_q)}
                      </span>
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-bold mr-1">
                        Short: {exam.short_total_marks}
                      </span>
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] font-bold">
                        Long: {exam.long_total_marks}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">{exam.total_marks} Marks</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        exam.status === 'GRADED' ? 'bg-emerald-100 text-emerald-800' :
                        exam.status === 'PUBLISHED' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {exam.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedExamForPaper(exam);
                          setShowPrintPaperModal(true);
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-[11px] inline-flex items-center gap-1"
                        title="Print Exam Test Paper"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-600" /> Print Paper
                      </button>
                      <button
                        onClick={() => {
                          setEvalSelectedExamId(exam.id);
                          setActiveTab('evaluate');
                        }}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded text-[11px] inline-flex items-center gap-1"
                      >
                        <PenTool className="w-3.5 h-3.5" /> Grade
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DUAL QUESTION BANK & EXCEL UPLOAD */}
      {activeTab === 'bank' && (
        <div className="bg-white p-6 rounded-b-xl border-x border-b border-slate-200 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Column: Chapter Hierarchy Tree */}
            <div className="lg:col-span-1 border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5">
                  <FolderTree className="w-4 h-4 text-indigo-600" />
                  Chapter Tree
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">{chapters.length} folders</span>
              </div>

              <div className="space-y-1 text-xs">
                <button
                  onClick={() => setSelectedChapterId('all')}
                  className={`w-full text-left px-3 py-2 rounded-lg font-medium transition-colors flex items-center justify-between ${
                    selectedChapterId === 'all'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span>All Chapters</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded ${selectedChapterId === 'all' ? 'bg-indigo-800' : 'bg-slate-200'}`}>
                    {bankQuestions.length}
                  </span>
                </button>

                {chapters.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedChapterId(c.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg font-medium transition-colors flex items-center justify-between ${
                      selectedChapterId === c.id
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span className="truncate pr-2">Ch {c.chapter_number}: {c.chapter_name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded shrink-0 ${selectedChapterId === c.id ? 'bg-indigo-800' : 'bg-slate-200'}`}>
                      {c.question_count || 0}
                    </span>
                  </button>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-200">
                <button
                  onClick={() => setShowAddQuestionModal(true)}
                  className="w-full py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-600" /> Add Question
                </button>
              </div>
            </div>

            {/* Right 3 Columns: Questions Repository */}
            <div className="lg:col-span-3 space-y-4">
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-slate-500 font-semibold">Subject:</span>
                  <select
                    value={selectedSubjectId}
                    onChange={e => setSelectedSubjectId(e.target.value)}
                    className="p-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>

                  <div className="flex border border-slate-300 bg-white rounded-lg p-0.5 ml-2">
                    {(['ALL', 'MCQ', 'SHORT', 'LONG'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setQuestionTypeFilter(t)}
                        className={`px-2 py-1 rounded text-[10px] font-bold ${
                          questionTypeFilter === t ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search question text..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-3">
                {filteredQuestions.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                    No questions found matching your filter criteria.
                  </div>
                ) : (
                  filteredQuestions.map((q, idx) => (
                    <div key={q.id} className="p-4 bg-white border border-slate-200 rounded-xl hover:shadow-2xs transition-all space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            q.question_type === 'MCQ' ? 'bg-blue-100 text-blue-800' :
                            q.question_type === 'SHORT' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {q.question_type}
                          </span>
                          <span className="text-[11px] font-bold text-slate-700">{q.marks} Marks</span>
                          {q.chapter_name && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              {q.chapter_name}
                            </span>
                          )}
                          <span className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-mono ${
                            q.difficulty_level === 'HARD' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {q.difficulty_level}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
                      </div>

                      <p className="text-xs font-semibold text-slate-900 leading-relaxed">
                        {q.question_text}
                      </p>

                      {/* MCQs Option Grid */}
                      {q.question_type === 'MCQ' && q.options && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {q.options.map(opt => (
                            <div
                              key={opt.key}
                              className={`p-2 rounded text-xs flex items-center gap-2 border ${
                                q.correct_option === opt.key
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                                  : 'bg-slate-50 border-slate-200 text-slate-600'
                              }`}
                            >
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                                q.correct_option === opt.key ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                              }`}>
                                {opt.key}
                              </span>
                              <span>{opt.text}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Rubric Guide for Short/Long */}
                      {q.rubric_guide && (
                        <div className="p-2 rounded bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-1.5 mt-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                          <span><strong>Teacher Scoring Guide:</strong> {q.rubric_guide}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HYBRID EVALUATION DESK & QUESTION REMARKS */}
      {activeTab === 'evaluate' && (
        <div className="bg-white p-6 rounded-b-xl border-x border-b border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">Streamlined Hybrid Grading Flow & Teacher Feedback</h2>
              <p className="text-xs text-slate-500">100% Fully Auto-Checked MCQs with instant scoring + Manual marks and question-level feedback remarks for Short & Long questions.</p>
            </div>

            {/* Exam & Student Selector */}
            <div className="flex items-center gap-3">
              <div>
                <span className="block text-[10px] text-slate-500 uppercase font-bold">Select Exam:</span>
                <select
                  value={evalSelectedExamId}
                  onChange={e => setEvalSelectedExamId(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                >
                  {exams.map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.title} ({ex.total_marks}M)</option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-[10px] text-slate-500 uppercase font-bold">Select Student:</span>
                <select
                  value={evalSelectedStudentId}
                  onChange={e => setEvalSelectedStudentId(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                >
                  {students.map(st => (
                    <option key={st.id} value={st.id}>{st.full_name} ({st.roll_number})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {evalSaveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {evalSaveSuccess}
              </span>
              <button
                onClick={() => setEvalSaveSuccess('')}
                className="text-emerald-700 hover:text-emerald-900 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {currentExam ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Columns: Checking & Grading Console */}
              <div className="lg:col-span-2 space-y-6">
                {/* SECTION A: OBJECTIVE MCQS (100% Fully Auto-Checked) */}
                <div className="border border-blue-200 rounded-xl p-5 bg-blue-50/30 space-y-4">
                  <div className="flex items-center justify-between border-b border-blue-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">1</span>
                      <div>
                        <h3 className="font-bold text-xs text-blue-950 uppercase">{currentExam.section_labels.mcq}</h3>
                        <p className="text-[11px] text-blue-700">100% Fully Auto-Graded in milliseconds</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-blue-600 text-white font-black text-xs">
                      Auto Score: {autoCalculatedMcqScore} / {currentExam.mcq_total_marks || (currentExam.mcq_count * currentExam.mcq_marks_per_q)} Marks
                    </span>
                  </div>

                  <div className="space-y-3">
                    {activeExamMcqs.length === 0 ? (
                      <div className="text-xs text-slate-500 italic p-3 bg-white rounded-lg border border-slate-200">
                        No MCQs assigned to this exam paper. Auto-scoring = 0.
                      </div>
                    ) : (
                      activeExamMcqs.map((mcq, mIdx) => {
                        const chosen = evalMcqAnswers[mcq.id] || '';
                        const isCorrect = chosen && mcq.correct_option && chosen.toUpperCase() === mcq.correct_option.toUpperCase();
                        return (
                          <div key={mcq.id} className="p-3 bg-white rounded-lg border border-slate-200 space-y-2 text-xs">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-semibold text-slate-800">
                                {mIdx + 1}. {mcq.question_text}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                !chosen ? 'bg-slate-100 text-slate-600' :
                                isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {!chosen ? 'Unanswered' : isCorrect ? `Correct (+${mcq.marks}M)` : 'Incorrect (0M)'}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 pt-1">
                              <span className="text-slate-500 text-[11px]">Student Response:</span>
                              {(['A', 'B', 'C', 'D'] as const).map(opt => (
                                <button
                                  type="button"
                                  key={opt}
                                  onClick={() => setEvalMcqAnswers({ ...evalMcqAnswers, [mcq.id]: opt })}
                                  className={`w-7 h-7 rounded-lg text-xs font-bold border transition-all ${
                                    chosen === opt
                                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                                      : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                              <span className="text-[11px] text-slate-400 ml-auto">
                                Key: <strong className="text-emerald-700">{mcq.correct_option || 'N/A'}</strong>
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* SECTION B: SHORT QUESTIONS (Manual Score + Question Remarks) */}
                <div className="border border-amber-200 rounded-xl p-5 bg-amber-50/30 space-y-4">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center">2</span>
                      <div>
                        <h3 className="font-bold text-xs text-amber-950 uppercase">{currentExam.section_labels.short}</h3>
                        <p className="text-[11px] text-amber-700">Obtained marks entry & section-specific remarks</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-amber-600 text-white font-black text-xs">
                      Max: {currentExam.short_total_marks} Marks
                    </span>
                  </div>

                  <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Short Questions Obtained Marks:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max={currentExam.short_total_marks}
                          value={evalShortScore}
                          onChange={e => setEvalShortScore(parseFloat(e.target.value) || 0)}
                          className="w-32 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-900"
                        />
                        <span className="text-xs text-slate-500 font-semibold">/ {currentExam.short_total_marks} Marks</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                        Question-Level Teacher Remarks (Short Questions):
                      </label>
                      <textarea
                        rows={2}
                        value={evalShortRemarks}
                        onChange={e => setEvalShortRemarks(e.target.value)}
                        placeholder="e.g. Definitions were concise and accurate; review question 3 formula derivation."
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-xs text-slate-800 leading-relaxed focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION C: LONG QUESTIONS (Manual Score + Question Remarks) */}
                <div className="border border-purple-200 rounded-xl p-5 bg-purple-50/30 space-y-4">
                  <div className="flex items-center justify-between border-b border-purple-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center">3</span>
                      <div>
                        <h3 className="font-bold text-xs text-purple-950 uppercase">{currentExam.section_labels.long}</h3>
                        <p className="text-[11px] text-purple-700">Obtained marks entry & section-specific remarks</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-purple-600 text-white font-black text-xs">
                      Max: {currentExam.long_total_marks} Marks
                    </span>
                  </div>

                  <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Long Questions Obtained Marks:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max={currentExam.long_total_marks}
                          value={evalLongScore}
                          onChange={e => setEvalLongScore(parseFloat(e.target.value) || 0)}
                          className="w-32 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold text-slate-900"
                        />
                        <span className="text-xs text-slate-500 font-semibold">/ {currentExam.long_total_marks} Marks</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                        Question-Level Teacher Remarks (Long Questions):
                      </label>
                      <textarea
                        rows={2}
                        value={evalLongRemarks}
                        onChange={e => setEvalLongRemarks(e.target.value)}
                        placeholder="e.g. Good problem analysis; lost 2 marks on vector diagram labeling."
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-xs text-slate-800 leading-relaxed focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right 1 Column: Result Summary Card & Batch Evaluations */}
              <div className="space-y-6">
                {/* Result Card */}
                <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="font-black text-xs uppercase tracking-wider text-indigo-400">Total Final Marks</h3>
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold">
                      {currentStudent?.roll_number}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Section A (Auto MCQs):</span>
                      <strong className="text-white">{autoCalculatedMcqScore} Marks</strong>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Section B (Short Questions):</span>
                      <strong className="text-white">{evalShortScore} Marks</strong>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Section C (Long Questions):</span>
                      <strong className="text-white">{evalLongScore} Marks</strong>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Obtained</span>
                      <div className="text-3xl font-black text-white">
                        {totalCalculatedObtained} <span className="text-sm font-normal text-slate-400">/ {examTotalMarks}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Grade</span>
                      <div className="text-2xl font-black text-emerald-400">
                        {derivedGrade} <span className="text-xs text-slate-300 font-normal">({calculatedPercentage}%)</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveEvaluation}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Save & Publish Result
                  </button>
                </div>

                {/* Batch Evaluations Register */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <h4 className="font-bold text-slate-800">Batch Evaluations Register</h4>
                    <span className="text-[10px] text-slate-500 font-mono">{examEvaluations.length} Graded</span>
                  </div>

                  <div className="space-y-2">
                    {examEvaluations.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">No evaluations recorded yet for this exam.</p>
                    ) : (
                      examEvaluations.map(ev => (
                        <div key={ev.id} className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 block">{ev.student_name}</span>
                            <span className="text-[10px] text-slate-500">Roll: {ev.roll_number} • {ev.percentage}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-black text-xs">
                              {ev.grade}
                            </span>
                            <button
                              onClick={() => handleOpenReportCard(ev.exam_id, ev.student_id)}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                              title="Print Official Report Card"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs">
              No exam selected. Please select an exam to begin hybrid grading.
            </div>
          )}
        </div>
      )}

      {/* CREATE NEW EXAM MODAL */}
      {showCreateExamModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" /> Create New Exam Setup
              </h3>
              <button onClick={() => setShowCreateExamModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Exam Title</label>
                <input
                  type="text"
                  required
                  value={newExamTitle}
                  onChange={e => setNewExamTitle(e.target.value)}
                  placeholder="e.g. Physics Grand Test - Chapter 1 to 3"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Batch / Section</label>
                  <select
                    value={newExamBatchId}
                    onChange={e => setNewExamBatchId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Subject</label>
                  <select
                    value={newExamSubjectId}
                    onChange={e => setNewExamSubjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Exam Date</label>
                  <input
                    type="date"
                    required
                    value={newExamDate}
                    onChange={e => setNewExamDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="15"
                    value={newExamDuration}
                    onChange={e => setNewExamDuration(parseInt(e.target.value) || 60)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Section Configuration with auto-sum */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                  Question Section Marks Configuration
                </h4>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">MCQs Count:</label>
                    <input
                      type="number"
                      min="0"
                      value={newExamMcqCount}
                      onChange={e => setNewExamMcqCount(parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">Marks Per MCQ:</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={newExamMcqMarksPerQ}
                      onChange={e => setNewExamMcqMarksPerQ(parseFloat(e.target.value) || 1)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">MCQ Total:</label>
                    <div className="px-2 py-1 bg-blue-100 text-blue-900 rounded font-black text-center">
                      {newExamMcqCount * newExamMcqMarksPerQ} M
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">Short Questions Total Marks:</label>
                    <input
                      type="number"
                      min="0"
                      value={newExamShortMarks}
                      onChange={e => setNewExamShortMarks(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold text-amber-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-0.5">Long Questions Total Marks:</label>
                    <input
                      type="number"
                      min="0"
                      value={newExamLongMarks}
                      onChange={e => setNewExamLongMarks(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded font-bold text-purple-900"
                    />
                  </div>
                </div>

                {/* Custom Question Labels & Numbering */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <span className="font-bold text-slate-700 text-[11px] block">Custom Question Numbering / Labels:</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 block">MCQ Label:</label>
                      <input
                        type="text"
                        value={newExamMcqLabel}
                        onChange={e => setNewExamMcqLabel(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block">Short Questions Label:</label>
                      <input
                        type="text"
                        value={newExamShortLabel}
                        onChange={e => setNewExamShortLabel(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block">Long Questions Label:</label>
                      <input
                        type="text"
                        value={newExamLongLabel}
                        onChange={e => setNewExamLongLabel(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-[11px]"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-700 text-xs">Total Exam Marks (Auto-Sum):</span>
                  <span className="px-3 py-1 bg-slate-900 text-white rounded-lg font-black text-sm">
                    {(newExamMcqCount * newExamMcqMarksPerQ) + Number(newExamShortMarks) + Number(newExamLongMarks)} Marks
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateExamModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-xs"
                >
                  Create Exam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE TEST PAPER MODAL */}
      {showPrintPaperModal && selectedExamForPaper && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 print:hidden">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-600" />
                Exam Paper Preview & Print (A4 Format)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Print / Save PDF
                </button>
                <button onClick={() => setShowPrintPaperModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Test Paper A4 Sheet */}
            <div className="border border-slate-300 p-8 rounded-xl bg-white space-y-6 text-xs text-slate-900 font-serif">
              {/* Paper Header */}
              <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                <h2 className="text-xl font-black uppercase tracking-wide font-sans">{tenant?.name || 'APEX ACADEMY LAHORE'}</h2>
                <p className="text-xs font-sans text-slate-600">Gulberg III Campus, Lahore • Academic Session 2026-2027</p>
                <h3 className="text-base font-bold uppercase underline mt-2">{selectedExamForPaper.title}</h3>
                <div className="flex justify-between text-xs font-sans pt-2">
                  <span><strong>Subject:</strong> {selectedExamForPaper.subject_name || 'Physics'}</span>
                  <span><strong>Batch:</strong> {selectedExamForPaper.batch_name || 'MDCAT Morning'}</span>
                  <span><strong>Time Allowed:</strong> {selectedExamForPaper.duration_minutes} Mins</span>
                  <span><strong>Total Marks:</strong> {selectedExamForPaper.total_marks}</span>
                </div>
              </div>

              {/* Student Roll & Name Blank */}
              <div className="grid grid-cols-2 gap-4 pb-2 border-b border-slate-300 text-xs font-sans">
                <div>Student Name: _____________________________________</div>
                <div className="text-right">Roll Number: ________________________</div>
              </div>

              {/* SECTION A: MCQS */}
              <div className="space-y-3 font-sans">
                <div className="flex justify-between font-bold border-b border-slate-200 pb-1">
                  <span>{selectedExamForPaper.section_labels.mcq}</span>
                  <span>({selectedExamForPaper.mcq_total_marks || (selectedExamForPaper.mcq_count * selectedExamForPaper.mcq_marks_per_q)} Marks)</span>
                </div>
                <p className="text-[11px] text-slate-500 italic">Encircle the correct option. Each question carries {selectedExamForPaper.mcq_marks_per_q} mark.</p>
                
                <div className="space-y-2">
                  {selectedExamForPaper.questions?.filter(q => q.section_type === 'MCQ').map((q, idx) => (
                    <div key={q.id} className="space-y-1">
                      <div className="font-medium text-slate-800">
                        ({idx + 1}) {q.question_text}
                      </div>
                      <div className="grid grid-cols-4 gap-2 pl-4 text-slate-600 text-[11px]">
                        {q.options?.map(opt => (
                          <div key={opt.key}>({opt.key}) {opt.text}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION B: SHORT QUESTIONS */}
              <div className="space-y-3 font-sans">
                <div className="flex justify-between font-bold border-b border-slate-200 pb-1">
                  <span>{selectedExamForPaper.section_labels.short}</span>
                  <span>({selectedExamForPaper.short_total_marks} Marks)</span>
                </div>
                <p className="text-[11px] text-slate-500 italic">Write concise answers to the following questions.</p>
                
                <div className="space-y-4">
                  {selectedExamForPaper.questions?.filter(q => q.section_type === 'SHORT').map((q, idx) => (
                    <div key={q.id} className="space-y-1">
                      <div className="flex justify-between font-medium text-slate-800">
                        <span>({idx + 1}) {q.question_text}</span>
                        <span className="text-slate-500">[{q.marks}M]</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION C: LONG QUESTIONS */}
              <div className="space-y-3 font-sans">
                <div className="flex justify-between font-bold border-b border-slate-200 pb-1">
                  <span>{selectedExamForPaper.section_labels.long}</span>
                  <span>({selectedExamForPaper.long_total_marks} Marks)</span>
                </div>
                
                <div className="space-y-4">
                  {selectedExamForPaper.questions?.filter(q => q.section_type === 'LONG').map((q, idx) => (
                    <div key={q.id} className="space-y-1">
                      <div className="flex justify-between font-medium text-slate-800">
                        <span>({idx + 1}) {q.question_text}</span>
                        <span className="text-slate-500">[{q.marks}M]</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXCEL CHAPTER UPLOAD MODAL (Flow A) */}
      {showExcelImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                In-Context Chapter Excel / CSV Upload (Flow A)
              </h3>
              <button onClick={() => setShowExcelImportModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Paste rows copied directly from Excel. The engine automatically creates missing chapter folders and parses mixed MCQs, Short, and Long questions.
            </p>

            {importSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {importSuccessMsg}
              </div>
            )}

            <form onSubmit={handleExcelImport} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Academic Program</label>
                  <select
                    value={excelProgramId}
                    onChange={e => setExcelProgramId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {programs.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Subject</label>
                  <select
                    value={excelSubjectId}
                    onChange={e => setExcelSubjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Paste Excel Data (Comma or Tab Separated):
                </label>
                <div className="text-[11px] text-slate-400 mb-1 font-mono">
                  Columns: ChapterNum, ChapterName, Type (MCQ/SHORT/LONG), QuestionText, Marks, OptA, OptB, OptC, OptD, CorrectKey, Rubric
                </div>
                <textarea
                  rows={6}
                  required
                  value={excelTextRaw}
                  onChange={e => setExcelTextRaw(e.target.value)}
                  placeholder={`1,Vectors & Equilibrium,MCQ,Unit vector has magnitude of:,1,Zero,Unity,Inf,Variable,B,Definition\n2,Force & Motion,SHORT,State Newton's second law in momentum form.,4,,,,,,dp/dt = F`}
                  className="w-full p-3 font-mono border border-slate-300 rounded-lg text-xs leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowExcelImportModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" /> Parse & Import to Bank
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD QUESTION MODAL */}
      {showAddQuestionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" /> Add Question to Bank
              </h3>
              <button onClick={() => setShowAddQuestionModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddQuestion} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Subject</label>
                  <select
                    value={newQSubjectId}
                    onChange={e => setNewQSubjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Chapter Folder</label>
                  <select
                    value={newQChapterId}
                    onChange={e => setNewQChapterId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="">-- Ad-Hoc / General Quiz --</option>
                    {chapters.map(c => (
                      <option key={c.id} value={c.id}>Ch {c.chapter_number}: {c.chapter_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Question Type</label>
                  <select
                    value={newQType}
                    onChange={e => setNewQType(e.target.value as ExamQuestionType)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="MCQ">MCQ (Objective)</option>
                    <option value="SHORT">Short Question</option>
                    <option value="LONG">Long Problem</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Marks</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={newQMarks}
                    onChange={e => setNewQMarks(parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Difficulty</label>
                  <select
                    value={newQDifficulty}
                    onChange={e => setNewQDifficulty(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Question Statement</label>
                <textarea
                  rows={3}
                  required
                  value={newQText}
                  onChange={e => setNewQText(e.target.value)}
                  placeholder="Type full question statement here..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* MCQs Option Fields */}
              {newQType === 'MCQ' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <span className="font-bold text-[11px] text-slate-700 block">MCQ Options:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Option A" value={newQOptionA} onChange={e => setNewQOptionA(e.target.value)} className="px-2 py-1 border border-slate-300 rounded" />
                    <input type="text" placeholder="Option B" value={newQOptionB} onChange={e => setNewQOptionB(e.target.value)} className="px-2 py-1 border border-slate-300 rounded" />
                    <input type="text" placeholder="Option C" value={newQOptionC} onChange={e => setNewQOptionC(e.target.value)} className="px-2 py-1 border border-slate-300 rounded" />
                    <input type="text" placeholder="Option D" value={newQOptionD} onChange={e => setNewQOptionD(e.target.value)} className="px-2 py-1 border border-slate-300 rounded" />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] font-bold text-slate-600">Correct Option:</span>
                    {(['A', 'B', 'C', 'D'] as const).map(opt => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => setNewQCorrectOption(opt)}
                        className={`px-3 py-1 rounded text-xs font-bold ${newQCorrectOption === opt ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Scoring Rubric */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Scoring Rubric / Solution Guidance</label>
                <input
                  type="text"
                  value={newQRubric}
                  onChange={e => setNewQRubric(e.target.value)}
                  placeholder="e.g. Formula (2 marks), Derivation (2 marks)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddQuestionModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-xs"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICIAL STUDENT REPORT CARD MODAL */}
      {showReportCardModal && activeReportCard && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 print:hidden">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-600" />
                Official Student Report Card
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Print / Save PDF
                </button>
                <button onClick={() => setShowReportCardModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Report Card Sheet */}
            <div className="border border-slate-300 p-8 rounded-xl bg-white space-y-6 text-xs font-mono">
              {/* Academy Branding Header */}
              <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                <h2 className="text-lg font-black uppercase tracking-tight">{tenant?.name || 'APEX ACADEMY LAHORE'}</h2>
                <p className="text-[10px] text-slate-500">Gulberg III Campus, Lahore • Official Assessment Report Card</p>
                <span className="inline-block px-3 py-0.5 rounded bg-indigo-900 text-white text-[10px] font-bold tracking-widest mt-1">
                  ACADEMIC PERFORMANCE STATEMENT
                </span>
              </div>

              {/* Student Bio Grid */}
              <div className="grid grid-cols-2 gap-3 text-[11px] border-b border-slate-200 pb-3">
                <div>
                  <span className="text-slate-400 block text-[10px]">Student Name:</span>
                  <span className="font-bold text-slate-900">{activeReportCard.student.full_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">Roll Number:</span>
                  <span className="font-bold text-indigo-700">{activeReportCard.student.roll_number}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Guardian / Father:</span>
                  <span className="text-slate-800">{activeReportCard.student.guardian_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">Batch & Class:</span>
                  <span className="text-slate-800">{activeReportCard.student.batch_name}</span>
                </div>
              </div>

              {/* Assessment Title */}
              <div className="text-center bg-slate-50 py-2 border border-slate-200 rounded font-bold text-slate-800">
                {activeReportCard.exam.title} ({activeReportCard.exam.exam_date})
              </div>

              {/* Section-by-Section Score Breakdown Table */}
              <table className="w-full text-left border-collapse border border-slate-300">
                <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-700">
                  <tr>
                    <th className="border border-slate-300 p-2">Section & Component</th>
                    <th className="border border-slate-300 p-2 text-center">Max Marks</th>
                    <th className="border border-slate-300 p-2 text-center">Obtained</th>
                    <th className="border border-slate-300 p-2">Teacher Assessment Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-300 p-2 font-bold">{activeReportCard.exam.section_labels.mcq}</td>
                    <td className="border border-slate-300 p-2 text-center">{activeReportCard.exam.mcq_total_marks || (activeReportCard.exam.mcq_count * activeReportCard.exam.mcq_marks_per_q)}</td>
                    <td className="border border-slate-300 p-2 text-center font-bold text-blue-700">{activeReportCard.evaluation.mcq_score}</td>
                    <td className="border border-slate-300 p-2 text-slate-600 text-[10px]">100% Fully Auto-Evaluated</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-bold">{activeReportCard.exam.section_labels.short}</td>
                    <td className="border border-slate-300 p-2 text-center">{activeReportCard.exam.short_total_marks}</td>
                    <td className="border border-slate-300 p-2 text-center font-bold text-amber-700">{activeReportCard.evaluation.short_score}</td>
                    <td className="border border-slate-300 p-2 text-slate-800 text-[10px] font-sans">
                      {activeReportCard.evaluation.short_remarks || 'Satisfactory responses.'}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-2 font-bold">{activeReportCard.exam.section_labels.long}</td>
                    <td className="border border-slate-300 p-2 text-center">{activeReportCard.exam.long_total_marks}</td>
                    <td className="border border-slate-300 p-2 text-center font-bold text-purple-700">{activeReportCard.evaluation.long_score}</td>
                    <td className="border border-slate-300 p-2 text-slate-800 text-[10px] font-sans">
                      {activeReportCard.evaluation.long_remarks || 'Good mathematical execution.'}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Total Marks & Grade Banner */}
              <div className="grid grid-cols-4 gap-2 bg-slate-900 text-white p-4 rounded-xl text-center">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Total Marks</span>
                  <strong className="text-base">{activeReportCard.exam.total_marks}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Obtained</span>
                  <strong className="text-base text-emerald-400">{activeReportCard.evaluation.total_obtained}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Percentage</span>
                  <strong className="text-base">{activeReportCard.evaluation.percentage}%</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block">Grade & Rank</span>
                  <strong className="text-base text-amber-400">{activeReportCard.evaluation.grade} (Rank #{activeReportCard.rank})</strong>
                </div>
              </div>

              {/* Signature Blocks */}
              <div className="pt-12 grid grid-cols-2 gap-8 text-center text-slate-600 text-[11px] font-sans">
                <div className="border-t border-slate-400 pt-2">
                  Examiner / Subject Faculty Signature
                </div>
                <div className="border-t border-slate-400 pt-2">
                  Academic Principal / Director Signature
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
