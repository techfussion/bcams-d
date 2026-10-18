/**
 * Domain Logic barrel export
 */
export { 
  computeAttendanceRate,
  evaluateEligibility,
  evaluateAttendanceQualification,
  classifyPunctuality,
  summarizeSessionAttendance,
  type AttendanceRateResult,
  type EligibilityResult,
  type AttendanceQualificationResult,
  type SessionAttendanceSummary,
} from './attendance-rules';

export {
  generateCSV,
  downloadCSV,
  printTable,
  type ExportColumn,
} from './export-utils';
