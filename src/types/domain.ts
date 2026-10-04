/**
 * BCAMS Domain Types — Remediated & Authoritative Model
 * 
 * Reflects strict institutional boundaries:
 * - Roles: Super Admin, HOD, Lecturer, Student, Staff
 * - Capturer is a capability/assignment (Session Capture for Students, Gate Capture for Staff)
 * - Student Identity separated from time-dependent Academic Enrollment
 * - All Lecturers are Staff (Person -> Staff -> Lecturer specialization)
 * - Device as trusted physical capture endpoint
 * - Comprehensive Session Lifecycle with venue, primary/substitute authorization, and same-lecturer closure
 */

// ─── Identity, Roles & Capabilities ─────────────────────────────────────────

export type UserRole = 'super_admin' | 'hod' | 'lecturer' | 'student' | 'staff';

export type CaptureCapability = 'session_capture' | 'gate_capture' | null;

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  departmentId?: string;
  departmentName?: string;
  captureCapability?: CaptureCapability;
  studentId?: string; // Linked student record ID
  staffId?: string;   // Linked staff record ID / institutional staff code
  matricNumber?: string;
  avatarUrl?: string;
  lastLogin?: string;
}

// ─── Person Hierarchy ───────────────────────────────────────────────────────

export type PersonSpecialization = 'student' | 'lecturer' | 'staff';

export type BiometricEnrollmentStatus = 'not_enrolled' | 'partial' | 'activated' | 'complete';

export interface Person {
  id: string;
  fullName: string;
  specializations: PersonSpecialization[];
  departmentId: string;
  departmentName: string;
  biometricStatus: BiometricEnrollmentStatus;
  enrolledFingers: number; // 0–10 (minimum 4 for activation)
  createdAt: string;
  updatedAt: string;
}

// ─── Student Identity (Permanent Person Record) ─────────────────────────────

export type StudentLifecycleStatus = 'active' | 'graduated' | 'withdrawn' | 'suspended';

export interface Student extends Person {
  matricNumber: string;
  contactEmail?: string;
  contactPhone?: string;
  lifecycleStatus?: StudentLifecycleStatus;
  // Denormalized references to current active enrollment context
  currentLevel?: number; // 100, 200, 300, 400, 500
  currentProgramme?: string;
  currentSession?: string; // e.g. "2026/2027"
  // Legacy aliases for backwards compatibility with existing UI components
  level: number;
  programme: string;
  academicSession: string;
  status?: StudentLifecycleStatus;
  courseEnrollments: CourseEnrollment[];
  captureCapability?: CaptureCapability; // e.g. 'session_capture' for student capturers
}

// ─── Academic Enrollment (Time / Context-Dependent Record) ──────────────────

export type AcademicEnrollmentStatus = 'active' | 'completed' | 'deferred' | 'repeating';

export interface AcademicEnrollment {
  id: string;
  studentId: string;
  studentName: string;
  matricNumber: string;
  academicSession: string; // e.g. "2026/2027"
  departmentId: string;
  departmentName: string;
  programme: string; // e.g. "B.Sc. Computer Science"
  level: number; // 100, 200, 300, 400, 500
  semester: number; // 1 | 2
  status: AcademicEnrollmentStatus;
  enrolledCourses: CourseEnrollment[];
  createdAt: string;
  updatedAt: string;
}

// ─── Staff & Lecturer Specialization ────────────────────────────────────────

export type StaffType = 'academic' | 'non_academic';

export interface Staff extends Person {
  staffId: string; // Institutional Staff Code e.g. "STF/CS/010"
  designation: string; // e.g. "Laboratory Technician", "Senior Lecturer", "Admin Officer"
  staffType?: StaffType;
  isLecturer?: boolean; // Indicates if this staff member also teaches courses
  contactEmail?: string;
  contactPhone?: string;
  captureCapability?: CaptureCapability; // e.g. 'gate_capture' for staff gate capturers
}

export interface Lecturer extends Person {
  staffId: string; // Institutional Staff Code
  staffPersonId?: string; // Foreign key linking to underlying Staff record
  designation?: string; // Academic rank
  contactEmail?: string;
  contactPhone?: string;
  assignedCourses: LecturerAssignment[];
}

// ─── Academic Entities ──────────────────────────────────────────────────────

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
  isGeneral: boolean; // cross-department GST course
  level: number;
  semester: number;
}

export interface AssignedLecturer {
  lecturerId: string;
  lecturerName: string;
  isPrimary: boolean;
  isSubstitute?: boolean;
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
  primaryLecturerId: string;
  primaryLecturerName: string;
  assignedLecturers: AssignedLecturer[] | string[]; // supports legacy string array and structured array
  approvedVenue: string; // Standard allocated venue e.g. "LT 1 - Main Auditorium"
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
  isPrimary?: boolean;
  isActive: boolean;
}

// ─── Session Lifecycle ──────────────────────────────────────────────────────

export type SessionState = 'draft' | 'authorized' | 'active' | 'closed' | 'expired';

export type SessionAuthorizationType = 'primary' | 'pre_assigned_substitute' | 'ad_hoc_substitute';

export interface Session {
  id: string;
  courseOfferingId: string;
  courseCode: string;
  courseTitle: string;
  departmentId?: string;
  state: SessionState;
  venue?: string; // Lecture venue entered/selected by the Student Session Capturer
  createdById?: string; // Student Session Capturer ID
  createdByName?: string; // Student Session Capturer Name
  lecturerId: string; // Authorized lecturer
  lecturerName: string;
  authorizationType?: SessionAuthorizationType;
  substituteLecturerId?: string;
  substituteLecturerName?: string;
  closureAuthorizedByLecturerId?: string; // Same lecturer who authorized start must authorize close!
  scheduledStart?: string;
  actualStart?: string;
  actualEnd?: string;
  maxDurationMinutes?: number; // e.g. 120 minutes timeout
  location?: GeoLocation;
  geofenceRadius: number;
  attendanceCount: number;
  enrolledCount: number;
  createdAt: string;
}

// ─── Class Attendance Events ────────────────────────────────────────────────

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

// ─── Biometrics ─────────────────────────────────────────────────────────────

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
export const ENROLLMENT_ACTIVATION_MIN = 4; // Minimum 4 fingers required

export interface FingerEnrollment {
  position: FingerPosition;
  enrolled: boolean;
  enrolledAt?: string;
  quality?: number; // 0–100
}

// ─── Trusted Physical Capture Endpoints (Devices) ───────────────────────────

export type DeviceLifecycleState = 'registered' | 'activated' | 'active' | 'suspended' | 'revoked' | 'retired';

export type DeviceStatus = 'pending' | 'active' | 'suspended' | 'revoked' | 'retired';

export type DevicePlatform = 'desktop' | 'mobile';

export type DeviceType = 'desktop_terminal' | 'mobile_scanner' | 'gate_kiosk';

export type DeviceTransport = 'usb' | 'bluetooth' | 'none';

export interface Device {
  id: string; // Unique Endpoint Identifier e.g. "EP-CS-001"
  name: string; // Human readable terminal name
  type?: DeviceType;
  platform: DevicePlatform;
  status: DeviceStatus;
  lifecycleState?: DeviceLifecycleState;
  serialNumber?: string;
  hardwareFingerprint?: string;
  assignedLocation?: string; // Specific venue or gate e.g. "Main Auditorium - Lecture Hall 1", "North Security Gate"
  assignedScope?: string; // Department or "Institution Gate"
  registeredAt: string;
  activatedAt?: string;
  lastSyncAt?: string;
  lastSeenAt?: string;
  hostname?: string;
  pendingEvents: number;
  scannerTransport: DeviceTransport;
  scannerModel?: string;
  scannerConnected: boolean;
}

// ─── Operational Policies ───────────────────────────────────────────────────

export type PolicyType = 'attendance_threshold' | 'session_duration' | 'geofence_radius' | 'biometric_enrollment' | 'staff_gate_hours' | 'punctuality_hours';

export type PolicyScope = 'institution' | 'department' | 'course';

export interface PolicyPunctualityValue {
  expectedStart: string; // "09:00"
  expectedEnd: string;   // "17:00"
  graceMinutes: number;  // 60 minutes
}

export interface Policy {
  id: string;
  type: PolicyType;
  title?: string;
  description?: string;
  scope: PolicyScope;
  scopeId?: string; // department or course ID if scoped
  scopeName?: string;
  value: number | string | PolicyPunctualityValue;
  effectiveFrom: string;
  version?: string; // e.g. "v1.2"
  createdBy: string;
  isActive: boolean;
}

// ─── Synchronization ────────────────────────────────────────────────────────

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'failed';
export type ConnectionStatus = 'online' | 'offline';

export interface SyncState {
  connection: ConnectionStatus;
  pendingEvents: number;
  lastSyncAt?: string;
  syncingNow: boolean;
  failedEvents: number;
}

// ─── Geolocation & Geofence ─────────────────────────────────────────────────

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export type GeofenceStatus = 'inside' | 'outside' | 'unavailable';

// ─── Audit Trail ────────────────────────────────────────────────────────────

export type AuditAction =
  | 'login' | 'logout'
  | 'person_created' | 'person_updated'
  | 'student_imported' | 'academic_enrollment_updated'
  | 'biometric_enrolled' | 'biometric_re_enrolled'
  | 'course_created' | 'course_updated'
  | 'lecturer_assigned' | 'lecturer_unassigned'
  | 'session_created' | 'session_authorized' | 'session_substitute_confirmed'
  | 'session_activated' | 'session_closed' | 'session_expired'
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

// ─── Scanner Hardware & Biometrics ──────────────────────────────────────────

export type ScannerState = 'disconnected' | 'ready' | 'scanning' | 'processing';

export type CaptureResult =
  | {
      type: 'success';
      personId: string;
      personName: string;
      registrationNumber?: string;
      qualityScore?: number;
      minutiaeCount?: number;
      sensorModel?: string;
      timestamp: string;
    }
  | {
      type: 'duplicate';
      personId: string;
      personName: string;
      originalTimestamp: string;
      timestamp?: string;
    }
  | {
      type: 'no_match';
      qualityScore?: number;
      minutiaeCount?: number;
      sensorModel?: string;
      timestamp: string;
    }
  | {
      type: 'geofence_rejected';
      timestamp: string;
    }
  | {
      type: 'error';
      message: string;
      timestamp?: string;
    };

// ─── Navigation Item ────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  roles?: UserRole[];
  capabilities?: CaptureCapability[];
  children?: NavItem[];
}
