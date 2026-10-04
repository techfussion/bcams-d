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
} from '@/types';

export interface BcamsApi {
  // Auth
  getCurrentUser(): Promise<User>;
  
  // Dashboard
  getDashboardStats(): Promise<Record<string, number>>;
  
  // Departments
  getDepartments(): Promise<Department[]>;
  getDepartment(id: string): Promise<Department>;
  createDepartment(department: Partial<Department>): Promise<Department>;
  
  // Courses
  getCourses(departmentId?: string): Promise<Course[]>;
  getCourseOfferings(departmentId?: string): Promise<CourseOffering[]>;
  getEligibleCoursesForStudent(studentId: string): Promise<CourseOffering[]>;
  createCourse(course: Partial<Course>): Promise<Course>;
  
  // People
  getStudents(departmentId?: string): Promise<Student[]>;
  getStudent(id: string): Promise<Student>;
  createStudent(student: Partial<Student>): Promise<Student>;
  updateStudent(id: string, updates: Partial<Student>): Promise<Student>;
  bulkImportStudents(records: any[]): Promise<{ importedCount: number; updatedEnrollments: number; errors: any[] }>;
  
  // Academic Enrollments
  getAcademicEnrollments(studentId?: string, departmentId?: string): Promise<AcademicEnrollment[]>;
  createAcademicEnrollment(enrollment: Partial<AcademicEnrollment>): Promise<AcademicEnrollment>;
  
  // Lecturers & Staff
  getLecturers(departmentId?: string): Promise<Lecturer[]>;
  getLecturer(id: string): Promise<Lecturer>;
  createLecturer(lecturer: Partial<Lecturer>): Promise<Lecturer>;
  linkStaffToLecturer(staffId: string, lecturerData: Partial<Lecturer>): Promise<Lecturer>;
  
  getStaff(departmentId?: string): Promise<Staff[]>;
  getStaffMember(id: string): Promise<Staff>;
  createStaff(staff: Partial<Staff>): Promise<Staff>;
  
  // Sessions
  getSessions(courseOfferingId?: string): Promise<Session[]>;
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
  
  // Audit
  getAuditEntries(limit?: number): Promise<AuditEntry[]>;
  
  // Biometric Enrollment
  getFingerEnrollments(personId: string): Promise<FingerEnrollment[]>;
  saveFingerEnrollment(personId: string, enrollment: Partial<FingerEnrollment>): Promise<FingerEnrollment>;
  
  // Sync
  getSyncState(): Promise<SyncState>;
}
