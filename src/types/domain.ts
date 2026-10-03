/**
 * BCAMS Domain Types
 * 
 * Core data models reflecting the BCAMS SRS entity definitions.
 * These types represent the frontend contract — they do NOT replicate
 * the backend database schema. The eventual real API adapter maps
 * backend responses to these types.
 */

// ─── Identity & Roles ───────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'hod' | 'lecturer' | 'class_rep';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  departmentId?: string;
  departmentName?: string;
  avatarUrl?: string;
  lastLogin?: string;
}

// ─── Person (Student / Lecturer / Staff) ────────────────────────────────────

export type PersonSpecialization = 'student' | 'lecturer' | 'staff';

export type StudentStatus = 'active' | 'inactive' | 'withdrawn' | 'graduated';

export interface Person {
  id: string;
  fullName: string;
  specializations: PersonSpecialization[];
  departmentId: string;
  departmentName: string;
  biometricStatus: BiometricEnrollmentStatus;
  enrolledFingers: number; // 0–10
  createdAt: string;
  updatedAt: string;
}

export interface Student extends Person {
  matricNumber: string;
  programme: string;
  level: number; // 100, 200, ...
  status: StudentStatus;
  academicSession: string;
  courseEnrollments: CourseEnrollment[];
}

export interface Lecturer extends Person {
  staffId: string;
  contactEmail?: string;
  contactPhone?: string;
  assignedCourses: LecturerAssignment[];
}

export interface Staff extends Person {
  staffId: string;
  designation: string;
  contactEmail?: string;
  contactPhone?: string;
}

// ─── Academic ───────────────────────────────────────────────────────────────

export interface Department {
  id: string;
  name: string;
  code: string;
  faculty?: string;
  hodId?: string;
  hodName?: string;
  studentCount: number;
  lecturerCount: number;
  staffCount: number;
  courseCount: number;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  departmentId: string;
  departmentName: string;
  creditUnits: number;
  isGeneral: boolean; // cross-department
  level: number;
  semester: number;
}

export interface CourseOffering {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  academicSession: string;
  semester: number;
  departmentId: string;
  departmentName: string;
  enrolledStudents: number;
  assignedLecturers: string[];
  approvedLocation?: GeoLocation;
  geofenceRadius: number; // metres, default 200
}

export type EnrollmentType = 'core' | 'elective' | 'carryover' | 'general';

export interface CourseEnrollment {
  id: string;
  studentId: string;
  courseOfferingId: string;
  courseCode: string;
  courseTitle: string;
  type: EnrollmentType;
  enrolledAt: string;
}

export interface LecturerAssignment {
  id: string;
  lecturerId: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  assignedFrom: string;
  assignedUntil?: string;
  isActive: boolean;
}

// ─── Session ────────────────────────────────────────────────────────────────

export type SessionState = 'draft' | 'authorized' | 'active' | 'closed' | 'expired';

export interface Session {
  id: string;
  courseOfferingId: string;
  courseCode: string;
  courseTitle: string;
  state: SessionState;
  lecturerId: string;
  lecturerName: string;
  substituteLecturerId?: string;
  substituteLecturerName?: string;
  scheduledStart?: string;
  actualStart?: string;
  actualEnd?: string;
  location?: GeoLocation;
  geofenceRadius: number;
  attendanceCount: number;
  enrolledCount: number;
  createdAt: string;
}

// ─── Attendance ─────────────────────────────────────────────────────────────

export type ClockIntegrityStatus = 'verified' | 'suspicious' | 'unverified';

export interface AttendanceEvent {
  id: string; // Event ID (globally unique)
  sessionId: string;
  studentId: string;
  studentName: string;
  matricNumber: string;
  timestamp: string;
  deviceId: string;
  clockIntegrity: ClockIntegrityStatus;
  syncStatus: SyncStatus;
  syncedAt?: string;
}

// ─── Staff Gate Attendance ──────────────────────────────────────────────────

export type ClockEventType = 'clock_in' | 'clock_out';
export type PunctualityClassification = 'on-time' | 'late';

export interface ClockEvent {
  id: string; // Event ID
  staffId: string;
  staffName: string;
  staffDepartment: string;
  type: ClockEventType;
  timestamp: string;
  punctuality?: PunctualityClassification; // Only for clock_in
  deviceId: string;
  clockIntegrity: ClockIntegrityStatus;
  syncStatus: SyncStatus;
  syncedAt?: string;
}

export interface DailyClockRecord {
  staffId: string;
  staffName: string;
  staffDepartment: string;
  date: string;
  clockIn?: ClockEvent;
  clockOut?: ClockEvent;
  additionalScans: number; // extra same-day scans (logged but ignored)
}

// ─── Biometric ──────────────────────────────────────────────────────────────

export type BiometricEnrollmentStatus = 'not_enrolled' | 'partial' | 'activated' | 'complete';

export type FingerPosition =
  | 'left_thumb' | 'left_index' | 'left_middle' | 'left_ring' | 'left_little'
  | 'right_thumb' | 'right_index' | 'right_middle' | 'right_ring' | 'right_little';

export const FINGER_POSITIONS: FingerPosition[] = [
  'left_thumb', 'left_index', 'left_middle', 'left_ring', 'left_little',
  'right_thumb', 'right_index', 'right_middle', 'right_ring', 'right_little',
];

export const FINGER_LABELS: Record<FingerPosition, string> = {
  left_thumb: 'Left Thumb',
  left_index: 'Left Index',
  left_middle: 'Left Middle',
  left_ring: 'Left Ring',
  left_little: 'Left Little',
  right_thumb: 'Right Thumb',
  right_index: 'Right Index',
  right_middle: 'Right Middle',
  right_ring: 'Right Ring',
  right_little: 'Right Little',
};

export const ENROLLMENT_TARGET = 10;
export const ENROLLMENT_ACTIVATION_MIN = 4;

export interface FingerEnrollment {
  position: FingerPosition;
  enrolled: boolean;
  enrolledAt?: string;
  quality?: number; // 0–100
}

// ─── Device ─────────────────────────────────────────────────────────────────

export type DeviceStatus = 'pending' | 'active' | 'suspended' | 'revoked' | 'retired';
export type DevicePlatform = 'desktop' | 'mobile';
export type DeviceTransport = 'usb' | 'bluetooth' | 'none';

export interface Device {
  id: string;
  name: string;
  platform: DevicePlatform;
  status: DeviceStatus;
  registeredAt: string;
  lastSyncAt?: string;
  assignedScope?: string;
  hostname?: string;
  pendingEvents: number;
  scannerTransport: DeviceTransport;
  scannerModel?: string;
  scannerConnected: boolean;
}

// ─── Policy ─────────────────────────────────────────────────────────────────

export type PolicyType = 'attendance_threshold' | 'punctuality_hours' | 'geofence_radius';
export type PolicyScope = 'institution' | 'department' | 'course';

export interface Policy {
  id: string;
  type: PolicyType;
  scope: PolicyScope;
  scopeId?: string; // department or course ID
  scopeName?: string;
  value: number | string | PolicyPunctualityValue;
  effectiveFrom: string;
  createdBy: string;
  isActive: boolean;
}

export interface PolicyPunctualityValue {
  expectedStart: string; // e.g., "09:00"
  expectedEnd: string;   // e.g., "17:00"
  graceMinutes: number;  // e.g., 60
}

// ─── Sync ───────────────────────────────────────────────────────────────────

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'failed';
export type ConnectionStatus = 'online' | 'offline';

export interface SyncState {
  connection: ConnectionStatus;
  pendingEvents: number;
  lastSyncAt?: string;
  syncingNow: boolean;
  failedEvents: number;
}

// ─── Geolocation ────────────────────────────────────────────────────────────

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export type GeofenceStatus = 'inside' | 'outside' | 'unavailable';

// ─── Audit ──────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'login' | 'logout'
  | 'person_created' | 'person_updated'
  | 'biometric_enrolled' | 'biometric_re_enrolled'
  | 'course_created' | 'course_updated'
  | 'lecturer_assigned' | 'lecturer_unassigned'
  | 'session_created' | 'session_authorized' | 'session_activated'
  | 'session_closed' | 'session_expired'
  | 'attendance_captured' | 'attendance_duplicate' | 'attendance_rejected'
  | 'clock_in' | 'clock_out' | 'clock_extra_scan'
  | 'device_registered' | 'device_activated' | 'device_suspended' | 'device_revoked'
  | 'sync_completed' | 'sync_failed'
  | 'report_generated' | 'report_printed' | 'report_exported'
  | 'policy_created' | 'policy_updated';

export interface AuditEntry {
  id: string;
  action: AuditAction;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  targetType: string;
  targetId?: string;
  targetLabel?: string;
  details?: string;
  timestamp: string;
  deviceId?: string;
  ipAddress?: string;
}

// ─── Scanner Interface (Abstraction) ────────────────────────────────────────

export type ScannerState = 'disconnected' | 'ready' | 'scanning' | 'processing';

export type CaptureResult =
  | { type: 'success'; personId: string; personName: string; timestamp: string }
  | { type: 'duplicate'; personId: string; personName: string; originalTimestamp: string }
  | { type: 'no_match'; timestamp: string }
  | { type: 'geofence_rejected'; timestamp: string }
  | { type: 'error'; message: string };

// ─── Navigation ─────────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  roles: UserRole[];
  children?: NavItem[];
}
