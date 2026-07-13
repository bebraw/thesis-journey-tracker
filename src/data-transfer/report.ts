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
        `${escapeMarkdownInlineText(student.name)} (${escapeMarkdownInlineText(getDegreeLabel(student.degreeType, DEGREE_TYPES))})`,
        `phase ${escapeMarkdownInlineText(getPhaseLabel(student.currentPhase, PHASES))}`,
        targetSubmissionDate ? `target ${targetSubmissionDate}` : "target not set",
        `meeting ${meetingStatus.toLowerCase()}`,
      ];

      if (latestLog) {
        parts.push(`last update ${escapeMarkdownInlineText(formatDateTime(latestLog.happenedAt))}`);
      }

      return `- ${parts.join("; ")}`;
    });

  const studentLines = studentBundles.map(({ student, latestLog }) => {
    const targetSubmissionDate = getTargetSubmissionDate(student);
    const meetingStatus = meetingStatusText(student, generatedAt);
    const parts = [
      `${escapeMarkdownInlineText(student.name)} (${escapeMarkdownInlineText(getDegreeLabel(student.degreeType, DEGREE_TYPES))})`,
      `phase ${escapeMarkdownInlineText(getPhaseLabel(student.currentPhase, PHASES))}`,
      targetSubmissionDate ? `target ${targetSubmissionDate}` : "target not set",
      `meeting ${meetingStatus.toLowerCase()}`,
    ];

    if (student.thesisTopic) {
      parts.push(`topic "${escapeMarkdownInlineText(student.thesisTopic)}"`);
    }

    if (latestLog) {
      parts.push(`last log ${escapeMarkdownInlineText(formatDateTime(latestLog.happenedAt))}`);
      parts.push(`agreed next step "${escapeMarkdownInlineText(latestLog.agreedPlan)}"`);
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

function escapeMarkdownInlineText(value: string): string {
  const singleLine = value
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/gu, " ")
    .replace(/[\u00ad\u061c\u200b\u200e\u200f\u202a-\u202e\u2060-\u206f\ufeff]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  const htmlSafe = singleLine.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return htmlSafe.replace(/[!-/:-@[-`{-~]/g, (character) => (character === "&" || character === ";" ? character : `\\${character}`));
}
