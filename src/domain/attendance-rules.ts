/**
 * Attendance Domain Logic
 * 
 * Business rules for attendance rate calculation,
 * exam eligibility determination, and policy evaluation.
 */
import type { 
  Policy, 
  PolicyPunctualityValue, 
  AttendanceEvent, 
  Session, 
  Student,
  ClockEvent,
  PunctualityClassification,
} from '@/types';

// ─── Attendance Rate ────────────────────────────────────────────────────────

export interface AttendanceRateResult {
  attended: number;
  total: number;
  percentage: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
}

export function computeAttendanceRate(
  attended: number,
  total: number
): AttendanceRateResult {
  const percentage = total === 0 ? 0 : Math.round((attended / total) * 100);
  let status: AttendanceRateResult['status'];

  if (percentage >= 90) status = 'excellent';
  else if (percentage >= 75) status = 'good';
  else if (percentage >= 60) status = 'warning';
  else status = 'critical';

  return { attended, total, percentage, status };
}

// ─── Exam Eligibility ───────────────────────────────────────────────────────

export interface EligibilityResult {
  eligible: boolean;
  attendancePercentage: number;
  requiredPercentage: number;
  deficit: number; // sessions needed to become eligible (0 if already eligible)
}

/**
 * Determine if a student meets the attendance threshold for exam eligibility.
 * Uses the most specific applicable policy (course > department > institution).
 */
export function evaluateEligibility(
  attended: number,
  totalSessions: number,
  applicablePolicies: Policy[],
  defaultThreshold: number = 75
): EligibilityResult {
  // Find the most specific attendance threshold policy
  const thresholdPolicy = applicablePolicies
    .filter(p => p.type === 'attendance_threshold' && p.isActive)
    .sort((a, b) => {
      const scopeOrder: Record<string, number> = { course: 0, department: 1, institution: 2 };
      return (scopeOrder[a.scope] ?? 3) - (scopeOrder[b.scope] ?? 3);
    })[0];

  const requiredPercentage = thresholdPolicy
    ? (typeof thresholdPolicy.value === 'number' ? thresholdPolicy.value : defaultThreshold)
    : defaultThreshold;

  const attendancePercentage = totalSessions === 0 ? 0 : Math.round((attended / totalSessions) * 100);
  const eligible = attendancePercentage >= requiredPercentage;

  // Calculate deficit: how many additional sessions needed
  let deficit = 0;
  if (!eligible && totalSessions > 0) {
    // (attended + x) / totalSessions >= requiredPercentage / 100
    const needed = Math.ceil((requiredPercentage / 100) * totalSessions) - attended;
    deficit = Math.max(needed, 0);
  }

  return { eligible, attendancePercentage, requiredPercentage, deficit };
}

// ─── Punctuality Classification ─────────────────────────────────────────────

/**
 * Classify a clock-in event based on applicable punctuality policy.
 */
export function classifyPunctuality(
  clockInTime: Date,
  policies: Policy[]
): PunctualityClassification {
  const punctualityPolicy = policies
    .filter(p => p.type === 'punctuality_hours' && p.isActive)
    .sort((a, b) => {
      const scopeOrder: Record<string, number> = { course: 0, department: 1, institution: 2 };
      return (scopeOrder[a.scope] ?? 3) - (scopeOrder[b.scope] ?? 3);
    })[0];

  if (!punctualityPolicy) {
    // Default: 9:00 AM start, 60 min grace
    return classifyWithThreshold(clockInTime, '09:00', 60);
  }

  const value = punctualityPolicy.value as PolicyPunctualityValue;
  return classifyWithThreshold(
    clockInTime,
    value.expectedStart,
    value.graceMinutes
  );
}

function classifyWithThreshold(
  clockInTime: Date,
  expectedStart: string,
  graceMinutes: number
): PunctualityClassification {
  const [hours, minutes] = expectedStart.split(':').map(Number);
  const deadline = new Date(clockInTime);
  deadline.setHours(hours, minutes + graceMinutes, 0, 0);
  return clockInTime <= deadline ? 'on-time' : 'late';
}

// ─── Session Statistics ─────────────────────────────────────────────────────

export interface SessionAttendanceSummary {
  sessionId: string;
  courseCode: string;
  totalEnrolled: number;
  totalPresent: number;
  attendanceRate: number;
  verifiedEvents: number;
  suspiciousEvents: number;
  unverifiedEvents: number;
}

export function summarizeSessionAttendance(
  session: Session,
  events: AttendanceEvent[]
): SessionAttendanceSummary {
  const sessionEvents = events.filter(e => e.sessionId === session.id);
  const attendanceRate = session.enrolledCount === 0
    ? 0
    : Math.round((sessionEvents.length / session.enrolledCount) * 100);

  return {
    sessionId: session.id,
    courseCode: session.courseCode,
    totalEnrolled: session.enrolledCount,
    totalPresent: sessionEvents.length,
    attendanceRate,
    verifiedEvents: sessionEvents.filter(e => e.clockIntegrity === 'verified').length,
    suspiciousEvents: sessionEvents.filter(e => e.clockIntegrity === 'suspicious').length,
    unverifiedEvents: sessionEvents.filter(e => e.clockIntegrity === 'unverified').length,
  };
}
