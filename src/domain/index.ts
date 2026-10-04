/**
 * Domain Logic barrel export
 */
export { 
  computeAttendanceRate,
  evaluateEligibility,
  classifyPunctuality,
  summarizeSessionAttendance,
  type AttendanceRateResult,
  type EligibilityResult,
  type SessionAttendanceSummary,
} from './attendance-rules';

export {
  generateCSV,
  downloadCSV,
  printTable,
  type ExportColumn,
} from './export-utils';
