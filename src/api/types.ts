/**
 * BCAMS API Abstraction
 * 
 * The service layer consumed by UI components.
 * Fully typed contract supporting academic progression, staff-lecturer links,
 * capturer course eligibility, same-lecturer session closure, and trusted device endpoints.
 */
import type {
  User, Department, Course, CourseOffering, Student, AcademicEnrollment,
  Lecturer, Staff, Session, AttendanceEvent, ClockEvent, DailyClockRecord,
  Device, Policy, AuditEntry, FingerEnrollment, SyncState,
  AcademicSession, BulkProgressionPreview, BulkProgressionResult,
} from '@/types';

export interface BcamsApi {
  // Auth
  getCurrentUser(): Promise<User>;

  // Dashboard
  getDashboardStats(scope?: { departmentId?: string; isInstitutionWide?: boolean; lecturerId?: string; academicSession?: string }): Promise<Record<string, any>>;

  // Departments
  getDepartments(): Promise<Department[]>;
  getDepartment(id: string): Promise<Department>;
  createDepartment(department: Partial<Department>): Promise<Department>;
  updateDepartment(id: string, updates: Partial<Department>): Promise<Department>;

  // Courses
  getCourses(departmentId?: string, lecturerId?: string): Promise<Course[]>;
  getCourseOfferings(departmentId?: string, lecturerId?: string): Promise<CourseOffering[]>;
  getEligibleCoursesForStudent(studentId: string): Promise<CourseOffering[]>;
  createCourse(course: Partial<Course>): Promise<Course>;
  updateCourse(id: string, updates: Partial<Course>): Promise<Course>;
  bulkImportCourses(records: any[]): Promise<{ importedCount: number; errors: any[] }>;
  assignLecturerToCourse(
    courseId: string,
    lecturerIdOrPayload: string | { primaryLecturerId?: string; primaryLecturerName?: string; substituteLecturerId?: string; substituteLecturerName?: string },
    isPrimary?: boolean,
    isSubstitute?: boolean
  ): Promise<Course>;

  // People
  getStudents(departmentId?: string): Promise<Student[]>;
  getStudent(id: string): Promise<Student>;
  createStudent(student: Partial<Student>): Promise<Student>;
  updateStudent(id: string, updates: Partial<Student>): Promise<Student>;
  bulkImportStudents(records: any[]): Promise<{ importedCount: number; updatedEnrollments: number; errors: any[] }>;
  assignSessionCapturer(studentId: string, assign: boolean): Promise<{ student: Student; user?: User }>;

  // Academic Enrollments
  getAcademicEnrollments(studentId?: string, departmentId?: string): Promise<AcademicEnrollment[]>;
  createAcademicEnrollment(enrollment: Partial<AcademicEnrollment>): Promise<AcademicEnrollment>;
  updateAcademicEnrollment(id: string, updates: Partial<AcademicEnrollment>): Promise<AcademicEnrollment>;

  // Academic Sessions & Bulk Progression
  getAcademicSessions(): Promise<AcademicSession[]>;
  createAcademicSession(session: Partial<AcademicSession>): Promise<AcademicSession>;
  updateAcademicSession(id: string, updates: Partial<AcademicSession>): Promise<AcademicSession>;
  setCurrentAcademicSession(id: string, semester?: 1 | 2): Promise<AcademicSession>;
  previewBulkProgression(targetSession: string, targetSemester: number): Promise<BulkProgressionPreview>;
  executeBulkProgression(targetSession: string, targetSemester: number): Promise<BulkProgressionResult>;

  // Lecturers & Staff
  getLecturers(departmentId?: string): Promise<Lecturer[]>;
  getLecturer(id: string): Promise<Lecturer>;
  createLecturer(lecturer: Partial<Lecturer>): Promise<Lecturer>;
  updateLecturer(id: string, updates: Partial<Lecturer>): Promise<Lecturer>;
  linkStaffToLecturer(staffId: string, lecturerData: Partial<Lecturer>): Promise<Lecturer>;
  bulkImportLecturers(records: any[]): Promise<{ importedCount: number; errors: any[] }>;

  getStaff(departmentId?: string): Promise<Staff[]>;
  getStaffMember(id: string): Promise<Staff>;
  createStaff(staff: Partial<Staff>): Promise<Staff>;
  updateStaff(id: string, updates: Partial<Staff>): Promise<Staff>;
  bulkImportStaff(records: any[]): Promise<{ importedCount: number; errors: any[] }>;
  assignHOD(staffId: string, departmentId: string, remove?: boolean): Promise<Staff>;

  // Sessions
  getSessions(courseOfferingId?: string, lecturerId?: string): Promise<Session[]>;
  getSession(id: string): Promise<Session>;
  createSession(session: Partial<Session>): Promise<Session>;
  authorizeSession(sessionId: string, lecturerId: string): Promise<Session>;
  activateSession(sessionId: string): Promise<Session>;
  closeSession(sessionId: string): Promise<Session>;
  closeSessionWithLecturer(sessionId: string, lecturerFingerprintId: string): Promise<{ success: boolean; session?: Session; error?: string }>;

  // Attendance
  getAttendanceEvents(sessionId: string): Promise<AttendanceEvent[]>;
  submitAttendanceCapture(event: Partial<AttendanceEvent>): Promise<AttendanceEvent>;

  // Gate Attendance (Admin & Operational)
  getClockEvents(departmentId?: string, date?: string): Promise<ClockEvent[]>;
  getDailyClockRecords(departmentId?: string, date?: string): Promise<DailyClockRecord[]>;
  getGateRecords(filters?: { startDate?: string; endDate?: string; departmentId?: string; punctuality?: string }): Promise<DailyClockRecord[]>;
  recordClockEvent(event: Partial<ClockEvent>): Promise<ClockEvent>;

  // Devices (Trusted Physical Endpoints)
  getDevices(): Promise<Device[]>;
  getDevice(id: string): Promise<Device>;
  registerDevice(device: Partial<Device>): Promise<Device>;
  updateDeviceLifecycle(id: string, state: string, notes?: string): Promise<Device>;

  // Policies (Operational Rules)
  getPolicies(): Promise<Policy[]>;
  createPolicy(policy: Partial<Policy>): Promise<Policy>;
  updatePolicy(id: string, updates: Partial<Policy>): Promise<Policy>;
  saveInstitutionalPolicies(policies: Partial<Policy>[]): Promise<Policy[]>;

  // Audit
  getAuditEntries(limit?: number): Promise<AuditEntry[]>;

  // Biometric Enrollment
  getFingerEnrollments(personId: string): Promise<FingerEnrollment[]>;
  saveFingerEnrollment(personId: string, enrollment: Partial<FingerEnrollment>): Promise<FingerEnrollment>;

  // Sync
  getSyncState(): Promise<SyncState>;
}
