import { formatDateTime } from "../formatting";
import { DEGREE_TYPES, getDegreeLabel, getPhaseLabel, getTargetSubmissionDate, meetingStatusText, PHASES } from "../students";
import type { StatusReportStudentBundle } from "./types";

export function buildProfessorReportFilename(timestamp = new Date()): string {
  const safeDate = timestamp.toISOString().slice(0, 10);
  return `thesis-journey-status-report-${safeDate}.md`;
}

export function createProfessorStatusReport(studentBundles: StatusReportStudentBundle[], generatedAt = new Date()): string {
  const today = generatedAt.toISOString().slice(0, 10);
  const overdueMeetings = studentBundles.filter(({ student }) => meetingStatusText(student, generatedAt) === "Overdue");
  const upcomingSoon = studentBundles.filter(({ student }) => meetingStatusText(student, generatedAt) === "Meeting soon");
  const noMeetingBooked = studentBundles.filter(({ student }) => meetingStatusText(student, generatedAt) === "Not booked");
  const pastTarget = studentBundles.filter(({ student }) => {
    const targetSubmissionDate = getTargetSubmissionDate(student);
    return Boolean(targetSubmissionDate && targetSubmissionDate < today && student.currentPhase !== "submitted");
  });

  const phaseLines = PHASES.map((phase) => {
    const count = studentBundles.filter(({ student }) => student.currentPhase === phase.id).length;
    return `- ${phase.label}: ${count}`;
  });

  const needsAttention = studentBundles
    .filter(({ student }) => {
      const meetingStatus = meetingStatusText(student, generatedAt);
      const targetSubmissionDate = getTargetSubmissionDate(student);
      return meetingStatus === "Overdue" || meetingStatus === "Not booked" || Boolean(targetSubmissionDate && targetSubmissionDate < today);
    })
    .map(({ student, latestLog }) => {
      const targetSubmissionDate = getTargetSubmissionDate(student);
      const meetingStatus = meetingStatusText(student, generatedAt);
      const parts = [
        `${student.name} (${getDegreeLabel(student.degreeType, DEGREE_TYPES)})`,
        `phase ${getPhaseLabel(student.currentPhase, PHASES)}`,
        targetSubmissionDate ? `target ${targetSubmissionDate}` : "target not set",
        `meeting ${meetingStatus.toLowerCase()}`,
      ];

      if (latestLog) {
        parts.push(`last update ${formatDateTime(latestLog.happenedAt)}`);
      }

      return `- ${parts.join("; ")}`;
    });

  const studentLines = studentBundles.map(({ student, latestLog }) => {
    const targetSubmissionDate = getTargetSubmissionDate(student);
    const meetingStatus = meetingStatusText(student, generatedAt);
    const parts = [
      `${student.name} (${getDegreeLabel(student.degreeType, DEGREE_TYPES)})`,
      `phase ${getPhaseLabel(student.currentPhase, PHASES)}`,
      targetSubmissionDate ? `target ${targetSubmissionDate}` : "target not set",
      `meeting ${meetingStatus.toLowerCase()}`,
    ];

    if (student.thesisTopic) {
      parts.push(`topic "${student.thesisTopic}"`);
    }

    if (latestLog) {
      parts.push(`last log ${formatDateTime(latestLog.happenedAt)}`);
      parts.push(`agreed next step "${latestLog.agreedPlan}"`);
    } else {
      parts.push("no supervision log yet");
    }

    return `- ${parts.join("; ")}`;
  });

  return [
    "# Thesis Supervision Status Report",
    "",
    `Generated: ${generatedAt.toISOString().slice(0, 10)}`,
    "",
    "## Summary",
    `- Total students: ${studentBundles.length}`,
    `- Submitted: ${studentBundles.filter(({ student }) => student.currentPhase === "submitted").length}`,
    `- Editing: ${studentBundles.filter(({ student }) => student.currentPhase === "editing").length}`,
    `- Overdue meetings: ${overdueMeetings.length}`,
    `- Meetings coming up within 2 weeks: ${upcomingSoon.length}`,
    `- No meeting booked: ${noMeetingBooked.length}`,
    `- Past target date and not yet submitted: ${pastTarget.length}`,
    "",
    "## Phase Breakdown",
    ...phaseLines,
    "",
    "## Students Needing Attention",
    ...(needsAttention.length > 0 ? needsAttention : ["- None at the moment."]),
    "",
    "## Student Updates",
    ...studentLines,
    "",
  ].join("\n");
}
