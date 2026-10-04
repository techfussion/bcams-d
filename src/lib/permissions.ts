/**
 * BCAMS Permission & Scope Model
 * 
 * Enforces role boundaries, capability scopes, and action authorization.
 * Role -> Capability -> Scope -> Allowed Workflow -> Allowed UI
 */
import type { User, UserRole, CaptureCapability } from '@/types';

export const isSuperAdmin = (user: User | null): user is User & { role: 'super_admin' } => {
  return user?.role === 'super_admin';
};

export const isHOD = (user: User | null): user is User & { role: 'hod' } => {
  return user?.role === 'hod';
};

export const isLecturer = (user: User | null): user is User & { role: 'lecturer' } => {
  return user?.role === 'lecturer';
};

export const isStudent = (user: User | null): user is User & { role: 'student' } => {
  return user?.role === 'student';
};

export const isStaff = (user: User | null): user is User & { role: 'staff' } => {
  return user?.role === 'staff';
};

/**
 * Capability Checks: Capturer is an assignment/capability on Student or Staff identity
 */
export const isSessionCapturer = (user: User | null): user is User & { role: 'student'; captureCapability: 'session_capture' } => {
  return user?.role === 'student' && user?.captureCapability === 'session_capture';
};

export const isGateCapturer = (user: User | null): user is User & { role: 'staff'; captureCapability: 'gate_capture' } => {
  return user?.role === 'staff' && user?.captureCapability === 'gate_capture';
};

export const isAnyCapturer = (user: User | null): user is User => {
  return isSessionCapturer(user) || isGateCapturer(user);
};

export const isAdministrator = (user: User | null): user is User => {
  return isSuperAdmin(user) || isHOD(user);
};

// ─── Operational Workflow Permissions ───────────────────────────────────────

/**
 * Staff Registration: Super Admin ONLY.
 * HODs cannot register staff members under the authoritative model.
 */
export const canRegisterStaff = (user: User | null): boolean => {
  return isSuperAdmin(user);
};

/**
 * Lecturer Registration: Super Admin or HOD (within HOD department).
 */
export const canRegisterLecturer = (user: User | null, departmentId?: string): boolean => {
  if (isSuperAdmin(user)) return true;
  if (isHOD(user) && departmentId) return user.departmentId === departmentId;
  return isHOD(user);
};

/**
 * Student Registration & Bulk Import: Super Admin or HOD within department.
 */
export const canManageStudents = (user: User | null, departmentId?: string): boolean => {
  if (isSuperAdmin(user)) return true;
  if (isHOD(user) && departmentId) return user.departmentId === departmentId;
  return isHOD(user);
};

/**
 * Academic Enrollment Management: Super Admin or HOD within department.
 */
export const canManageAcademicEnrollment = (user: User | null, departmentId?: string): boolean => {
  return canManageStudents(user, departmentId);
};

/**
 * Course & Curriculum Management: Super Admin or HOD within department.
 */
export const canManageCourses = (user: User | null, departmentId?: string): boolean => {
  if (isSuperAdmin(user)) return true;
  if (isHOD(user) && departmentId) return user.departmentId === departmentId;
  return isHOD(user);
};

/**
 * Lecturer-Course Assignment: Super Admin or HOD within department.
 */
export const canAssignLecturers = (user: User | null, departmentId?: string): boolean => {
  return canManageCourses(user, departmentId);
};

/**
 * Device Management (Trusted Endpoints): Super Admin ONLY.
 */
export const canManageDevices = (user: User | null): boolean => {
  return isSuperAdmin(user);
};

/**
 * Institutional Operational Policies: Super Admin ONLY.
 */
export const canManagePolicies = (user: User | null): boolean => {
  return isSuperAdmin(user);
};

/**
 * Gate Attendance Administrative Ledger & Export: Super Admin ONLY.
 * HODs and Capturers have NO access to administrative gate records.
 */
export const canViewGateLedger = (user: User | null): boolean => {
  return isSuperAdmin(user);
};

/**
 * Class Session Creation:
 * ONLY Student Session Capturers create class sessions.
 * Lecturers do NOT directly create sessions (they authorize via fingerprint).
 */
export const canCreateClassSession = (user: User | null): boolean => {
  return isSessionCapturer(user);
};

/**
 * Active Class Attendance Capture:
 * ONLY Student Session Capturers operate the class capture workspace.
 */
export const canOperateClassCapture = (user: User | null): boolean => {
  return isSessionCapturer(user);
};

/**
 * Gate Clock-In / Clock-Out Operation:
 * ONLY Staff Gate Capturers operate the gate terminal workspace.
 */
export const canOperateGateScanner = (user: User | null): boolean => {
  return isGateCapturer(user);
};

/**
 * Session Closure:
 * ONLY the Student Session Capturer can initiate session closure,
 * which requires biometric verification from the same lecturer who authorized it.
 */
export const canInitiateSessionClose = (user: User | null): boolean => {
  return isSessionCapturer(user);
};

/**
 * Biometric Enrollment Management:
 * Super Admin (all) or HOD (within authorized department).
 * Lecturers and Capturers have NO administrative biometric enrollment rights.
 */
export const canManageBiometrics = (user: User | null, departmentId?: string): boolean => {
  if (isSuperAdmin(user)) return true;
  if (isHOD(user) && departmentId) return user.departmentId === departmentId;
  return isHOD(user);
};

/**
 * Reports & Clearance Analytics:
 * Super Admin (all), HOD (department), Lecturer (assigned courses).
 * Capturers have NO general report interface.
 */
export const canViewReports = (user: User | null): boolean => {
  return isSuperAdmin(user) || isHOD(user) || isLecturer(user);
};

/**
 * Audit Trail Inspection: Super Admin ONLY.
 */
export const canViewAuditLog = (user: User | null): boolean => {
  return isSuperAdmin(user);
};

// ─── Scope Filter Utilities ─────────────────────────────────────────────────

export interface DataScope {
  departmentId?: string;
  courseIds?: string[];
  studentId?: string;
  isInstitutionWide: boolean;
}

export const getUserScope = (user: User | null): DataScope => {
  if (!user) {
    return { isInstitutionWide: false };
  }

  if (isSuperAdmin(user)) {
    return { isInstitutionWide: true };
  }

  if (isHOD(user)) {
    return {
      departmentId: user.departmentId,
      isInstitutionWide: false,
    };
  }

  if (isLecturer(user)) {
    return {
      departmentId: user.departmentId,
      isInstitutionWide: false,
    };
  }

  if (isStudent(user)) {
    return {
      departmentId: user.departmentId,
      studentId: user.studentId,
      isInstitutionWide: false,
    };
  }

  return {
    departmentId: user.departmentId,
    isInstitutionWide: false,
  };
};
