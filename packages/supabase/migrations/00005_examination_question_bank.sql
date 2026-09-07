-- ==============================================================================
-- Migration: 00005_examination_question_bank.sql
-- Description: Phase 5 - Question Bank, Excel Chapter Upload, Simple Exam Setup &
--              Hybrid Grading with Auto-MCQs & Question-Level Remarks
-- ==============================================================================

-- 1. Question Chapters (Hierarchical tree: Class -> Subject -> Chapter)
CREATE TABLE IF NOT EXISTS question_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  chapter_number INT NOT NULL,
  chapter_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, subject_id, chapter_number)
);

CREATE INDEX IF NOT EXISTS idx_question_chapters_tenant ON question_chapters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_question_chapters_subject ON question_chapters(tenant_id, subject_id);

-- 2. Bank Questions (Dual Mode: Permanent Master Bank vs Fast Ad-Hoc Quiz)
CREATE TABLE IF NOT EXISTS bank_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES question_chapters(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('MCQ', 'SHORT', 'LONG')),
  question_text TEXT NOT NULL,
  marks NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  options JSONB DEFAULT '[]'::jsonb, -- Array of { "key": "A", "text": "..." }
  correct_option TEXT,               -- 'A', 'B', 'C', 'D' for MCQs
  rubric_guide TEXT,
  difficulty_level TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (difficulty_level IN ('EASY', 'MEDIUM', 'HARD')),
  is_quiz_bank BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_questions_tenant ON bank_questions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bank_questions_chapter ON bank_questions(tenant_id, chapter_id);
CREATE INDEX IF NOT EXISTS idx_bank_questions_type ON bank_questions(tenant_id, question_type);

-- 3. Exams Master
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  exam_date DATE NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  total_marks NUMERIC(6,2) NOT NULL,
  mcq_count INT NOT NULL DEFAULT 0,
  mcq_marks_per_q NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  mcq_total_marks NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  short_total_marks NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  long_total_marks NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  section_labels JSONB DEFAULT '{"mcq": "Q.1 (Objective MCQs)", "short": "Q.2 (Short Questions)", "long": "Q.3 (Long Questions)"}'::jsonb,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'COMPLETED', 'GRADED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exams_tenant ON exams(tenant_id);
CREATE INDEX IF NOT EXISTS idx_exams_batch ON exams(tenant_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_exams_subject ON exams(tenant_id, subject_id);

-- 4. Exam Questions (Linked questions in the test paper)
CREATE TABLE IF NOT EXISTS exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id UUID REFERENCES bank_questions(id) ON DELETE SET NULL,
  section_type TEXT NOT NULL CHECK (section_type IN ('MCQ', 'SHORT', 'LONG')),
  display_order INT NOT NULL,
  question_text TEXT NOT NULL,
  marks NUMERIC(5,2) NOT NULL,
  options JSONB DEFAULT '[]'::jsonb,
  correct_option TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_questions_tenant ON exam_questions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions(tenant_id, exam_id);

-- 5. Student Exam Evaluations (Hybrid: Instant MCQ grading + Short/Long with remarks)
CREATE TABLE IF NOT EXISTS student_exam_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  mcq_answers JSONB DEFAULT '{}'::jsonb,
  mcq_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  short_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  short_remarks TEXT,
  long_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  long_remarks TEXT,
  total_obtained NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  grade TEXT NOT NULL DEFAULT 'F',
  status TEXT NOT NULL DEFAULT 'GRADED' CHECK (status IN ('ABSENT', 'IN_PROGRESS', 'GRADED')),
  evaluated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, exam_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_evaluations_tenant ON student_exam_evaluations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_evaluations_exam ON student_exam_evaluations(tenant_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_student_evaluations_student ON student_exam_evaluations(tenant_id, student_id);

-- Enable RLS and force isolation across all Phase 5 tables
ALTER TABLE question_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_chapters FORCE ROW LEVEL SECURITY;

ALTER TABLE bank_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_questions FORCE ROW LEVEL SECURITY;

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams FORCE ROW LEVEL SECURITY;

ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions FORCE ROW LEVEL SECURITY;

ALTER TABLE student_exam_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_exam_evaluations FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'question_chapters',
      'bank_questions',
      'exams',
      'exam_questions',
      'student_exam_evaluations'
    ])
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS %I ON %I;
      CREATE POLICY %I ON %I
        FOR ALL
        USING (
          tenant_id = get_current_tenant_id() 
          OR current_setting(''app.is_super_admin'', true) = ''true''
        )
        WITH CHECK (
          tenant_id = get_current_tenant_id() 
          OR current_setting(''app.is_super_admin'', true) = ''true''
        );
    ', tbl || '_isolation_policy', tbl, tbl || '_isolation_policy', tbl);
  END LOOP;
END
$$;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
