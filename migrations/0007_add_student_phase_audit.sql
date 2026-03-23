PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS student_phase_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  changed_at TEXT NOT NULL,
  from_phase TEXT NOT NULL CHECK (from_phase IN (
    'research_plan',
    'researching',
    'first_complete_draft',
    'editing',
    'submission_ready',
    'submitted'
  )),
  to_phase TEXT NOT NULL CHECK (to_phase IN (
    'research_plan',
    'researching',
    'first_complete_draft',
    'editing',
    'submission_ready',
    'submitted'
  )),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_student_phase_audit_student_id ON student_phase_audit (student_id, changed_at DESC);
