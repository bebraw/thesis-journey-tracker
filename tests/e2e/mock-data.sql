INSERT INTO students (
  name,
  email,
  degree_type,
  thesis_topic,
  start_date,
  target_submission_date,
  current_phase,
  next_meeting_at,
  is_mock
)
SELECT
  'Mia Koskinen',
  'mia.koskinen@example.edu',
  'msc',
  'Machine learning support for thesis supervision planning',
  '2026-01-10',
  '2026-07-10',
  'researching',
  '2026-03-29T10:00:00.000Z',
  1
WHERE NOT EXISTS (SELECT 1 FROM students WHERE name = 'Mia Koskinen' AND is_mock = 1);

INSERT INTO students (
  name,
  email,
  degree_type,
  thesis_topic,
  start_date,
  target_submission_date,
  current_phase,
  next_meeting_at,
  is_mock
)
SELECT
  'Noah Virtanen',
  'noah.virtanen@example.edu',
  'msc',
  'Collaborative drafting workflows for academic writing',
  '2025-12-01',
  '2026-06-01',
  'first_complete_draft',
  NULL,
  1
WHERE NOT EXISTS (SELECT 1 FROM students WHERE name = 'Noah Virtanen' AND is_mock = 1);

INSERT INTO students (
  name,
  email,
  degree_type,
  thesis_topic,
  start_date,
  target_submission_date,
  current_phase,
  next_meeting_at,
  is_mock
)
SELECT
  'Aino Lehtinen',
  'aino.lehtinen@example.edu',
  'dsc',
  'Automated quality checks for dissertation manuscripts',
  '2025-11-15',
  '2026-05-15',
  'editing',
  '2026-03-24T12:30:00.000Z',
  1
WHERE NOT EXISTS (SELECT 1 FROM students WHERE name = 'Aino Lehtinen' AND is_mock = 1);

INSERT INTO meeting_logs (student_id, happened_at, discussed, agreed_plan, next_step_deadline, is_mock)
SELECT
  s.id,
  '2026-03-10T09:00:00.000Z',
  'Defined thesis scope and final research questions for chapter 1.',
  'Collect five core papers and finish updated research plan draft.',
  '2026-03-20',
  1
FROM students s
WHERE s.name = 'Mia Koskinen'
  AND s.is_mock = 1
  AND NOT EXISTS (
    SELECT 1 FROM meeting_logs ml
    WHERE ml.student_id = s.id
      AND ml.happened_at = '2026-03-10T09:00:00.000Z'
      AND ml.is_mock = 1
  );

INSERT INTO meeting_logs (student_id, happened_at, discussed, agreed_plan, next_step_deadline, is_mock)
SELECT
  s.id,
  '2026-03-12T14:00:00.000Z',
  'Reviewed structure of full draft and identified weak discussion section.',
  'Rewrite discussion subsection and align claims with cited evidence.',
  '2026-03-26',
  1
FROM students s
WHERE s.name = 'Noah Virtanen'
  AND s.is_mock = 1
  AND NOT EXISTS (
    SELECT 1 FROM meeting_logs ml
    WHERE ml.student_id = s.id
      AND ml.happened_at = '2026-03-12T14:00:00.000Z'
      AND ml.is_mock = 1
  );

INSERT INTO meeting_logs (student_id, happened_at, discussed, agreed_plan, next_step_deadline, is_mock)
SELECT
  s.id,
  '2026-03-14T08:30:00.000Z',
  'Editing pass on methods/results transition and formatting issues.',
  'Deliver submission-ready version to supervisor for final checks.',
  '2026-03-28',
  1
FROM students s
WHERE s.name = 'Aino Lehtinen'
  AND s.is_mock = 1
  AND NOT EXISTS (
    SELECT 1 FROM meeting_logs ml
    WHERE ml.student_id = s.id
      AND ml.happened_at = '2026-03-14T08:30:00.000Z'
      AND ml.is_mock = 1
  );
