INSERT INTO students (
  name,
  email,
  degree_type,
  thesis_topic,
  start_date,
  current_phase,
  next_meeting_at
)
SELECT
  'Emma Nieminen',
  'emma.nieminen@example.edu',
  'msc',
  'LLM-assisted feedback loops for thesis supervision',
  strftime('%Y-%m-%d', 'now', '-2 months'),
  'researching',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '+3 days', '+9 hours')
WHERE NOT EXISTS (SELECT 1 FROM students WHERE name = 'Emma Nieminen');

INSERT INTO students (
  name,
  email,
  degree_type,
  thesis_topic,
  start_date,
  current_phase,
  next_meeting_at
)
SELECT
  'Leo Mikkola',
  'leo.mikkola@example.edu',
  'bsc',
  'Evaluating lightweight note-taking workflows in supervision meetings',
  strftime('%Y-%m-%d', 'now', '-5 months'),
  'first_complete_draft',
  NULL
WHERE NOT EXISTS (SELECT 1 FROM students WHERE name = 'Leo Mikkola');

INSERT INTO students (
  name,
  email,
  degree_type,
  thesis_topic,
  start_date,
  current_phase,
  next_meeting_at
)
SELECT
  'Sofia Laakso',
  'sofia.laakso@example.edu',
  'dsc',
  'Traceable revision histories for dissertation advising',
  strftime('%Y-%m-%d', 'now', '-7 months'),
  'editing',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '-2 days', '+13 hours', '+30 minutes')
WHERE NOT EXISTS (SELECT 1 FROM students WHERE name = 'Sofia Laakso');

INSERT INTO students (
  name,
  email,
  degree_type,
  thesis_topic,
  start_date,
  current_phase,
  next_meeting_at
)
SELECT
  'Otso Heikkinen',
  'otso.heikkinen@example.edu',
  'msc',
  'Practical dashboard design for supervision triage',
  strftime('%Y-%m-%d', 'now', '-9 months'),
  'submission_ready',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '+10 days', '+11 hours')
WHERE NOT EXISTS (SELECT 1 FROM students WHERE name = 'Otso Heikkinen');

INSERT INTO students (
  name,
  email,
  degree_type,
  thesis_topic,
  start_date,
  current_phase,
  next_meeting_at
)
SELECT
  'Aada Salonen',
  'aada.salonen@example.edu',
  'msc',
  'Archived thesis handoff patterns after final submission',
  strftime('%Y-%m-%d', 'now', '-13 months'),
  'submitted',
  NULL
WHERE NOT EXISTS (SELECT 1 FROM students WHERE name = 'Aada Salonen');

INSERT INTO meeting_logs (student_id, happened_at, discussed, agreed_plan, next_step_deadline)
SELECT
  s.id,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '-6 days', '+10 hours'),
  'Refined research scope and selected the most promising source set.',
  'Finish literature matrix and draft the background chapter outline.',
  strftime('%Y-%m-%d', 'now', '+7 days')
FROM students s
WHERE s.name = 'Emma Nieminen'
  AND NOT EXISTS (
    SELECT 1 FROM meeting_logs ml
    WHERE ml.student_id = s.id
      AND ml.happened_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '-6 days', '+10 hours')
  );

INSERT INTO meeting_logs (student_id, happened_at, discussed, agreed_plan, next_step_deadline)
SELECT
  s.id,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '-12 days', '+14 hours'),
  'Reviewed the first full draft and marked sections needing clearer evidence.',
  'Revise the methods and discussion sections before the next supervision check-in.',
  strftime('%Y-%m-%d', 'now', '+5 days')
FROM students s
WHERE s.name = 'Leo Mikkola'
  AND NOT EXISTS (
    SELECT 1 FROM meeting_logs ml
    WHERE ml.student_id = s.id
      AND ml.happened_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '-12 days', '+14 hours')
  );

INSERT INTO meeting_logs (student_id, happened_at, discussed, agreed_plan, next_step_deadline)
SELECT
  s.id,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '-4 days', '+8 hours', '+30 minutes'),
  'Focused on polishing argument structure and resolving remaining formatting issues.',
  'Prepare the near-final manuscript version and list any open examiner questions.',
  strftime('%Y-%m-%d', 'now', '+3 days')
FROM students s
WHERE s.name = 'Sofia Laakso'
  AND NOT EXISTS (
    SELECT 1 FROM meeting_logs ml
    WHERE ml.student_id = s.id
      AND ml.happened_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '-4 days', '+8 hours', '+30 minutes')
  );

INSERT INTO meeting_logs (student_id, happened_at, discussed, agreed_plan, next_step_deadline)
SELECT
  s.id,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '-8 days', '+11 hours'),
  'Confirmed submission checklist and reviewed final supervisor comments.',
  'Submit the thesis package after one last proofreading pass.',
  strftime('%Y-%m-%d', 'now', '+2 days')
FROM students s
WHERE s.name = 'Otso Heikkinen'
  AND NOT EXISTS (
    SELECT 1 FROM meeting_logs ml
    WHERE ml.student_id = s.id
      AND ml.happened_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '-8 days', '+11 hours')
  );

INSERT INTO student_phase_audit (student_id, changed_at, from_phase, to_phase)
SELECT
  s.id,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '-45 days', '+9 hours'),
  'research_plan',
  'researching'
FROM students s
WHERE s.name = 'Emma Nieminen'
  AND NOT EXISTS (
    SELECT 1 FROM student_phase_audit spa
    WHERE spa.student_id = s.id
      AND spa.changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '-45 days', '+9 hours')
  );

INSERT INTO student_phase_audit (student_id, changed_at, from_phase, to_phase)
SELECT
  s.id,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '-25 days', '+15 hours'),
  'researching',
  'first_complete_draft'
FROM students s
WHERE s.name = 'Leo Mikkola'
  AND NOT EXISTS (
    SELECT 1 FROM student_phase_audit spa
    WHERE spa.student_id = s.id
      AND spa.changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '-25 days', '+15 hours')
  );

INSERT INTO student_phase_audit (student_id, changed_at, from_phase, to_phase)
SELECT
  s.id,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '-30 days', '+10 hours'),
  'first_complete_draft',
  'editing'
FROM students s
WHERE s.name = 'Sofia Laakso'
  AND NOT EXISTS (
    SELECT 1 FROM student_phase_audit spa
    WHERE spa.student_id = s.id
      AND spa.changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '-30 days', '+10 hours')
  );

INSERT INTO student_phase_audit (student_id, changed_at, from_phase, to_phase)
SELECT
  s.id,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '-20 days', '+12 hours'),
  'editing',
  'submission_ready'
FROM students s
WHERE s.name = 'Otso Heikkinen'
  AND NOT EXISTS (
    SELECT 1 FROM student_phase_audit spa
    WHERE spa.student_id = s.id
      AND spa.changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '-20 days', '+12 hours')
  );

INSERT INTO student_phase_audit (student_id, changed_at, from_phase, to_phase)
SELECT
  s.id,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '-60 days', '+13 hours'),
  'submission_ready',
  'submitted'
FROM students s
WHERE s.name = 'Aada Salonen'
  AND NOT EXISTS (
    SELECT 1 FROM student_phase_audit spa
    WHERE spa.student_id = s.id
      AND spa.changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day', '-60 days', '+13 hours')
  );
