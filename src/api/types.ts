/**
 * BCAMS API Abstraction
 * 
 * The service layer that UI components consume.
 * Currently backed by mock data. When the real backend is ready,
 * swap the mock adapter for a real HTTP adapter.
 */
import type {
  User, Department, Course, CourseOffering, Student, Lecturer, Staff,
  Session, AttendanceEvent, ClockEvent, DailyClockRecord, Device,
  Policy, AuditEntry, FingerEnrollment, SyncState,
} from '@/types';

export interface BcamsApi {
  // Auth
  getCurrentUser(): Promise<User>;
  
  // Dashboard
  getDashboardStats(): Promise<Record<string, number>>;
  
  // Departments
  getDepartments(): Promise<Department[]>;
  getDepartment(id: string): Promise<Department>;
  
  // Courses
  getCourses(departmentId?: string): Promise<Course[]>;
  getCourseOfferings(departmentId?: string): Promise<CourseOffering[]>;
  
  // People
  getStudents(departmentId?: string): Promise<Student[]>;
  getStudent(id: string): Promise<Student>;
  getLecturers(departmentId?: string): Promise<Lecturer[]>;
  getLecturer(id: string): Promise<Lecturer>;
  getStaff(departmentId?: string): Promise<Staff[]>;
  getStaffMember(id: string): Promise<Staff>;
  
  // Sessions
  getSessions(courseOfferingId?: string): Promise<Session[]>;
  getSession(id: string): Promise<Session>;
  
  // Attendance
  getAttendanceEvents(sessionId: string): Promise<AttendanceEvent[]>;
  
  // Clock Events
  getClockEvents(departmentId?: string, date?: string): Promise<ClockEvent[]>;
  getDailyClockRecords(departmentId?: string, date?: string): Promise<DailyClockRecord[]>;
  
  // Devices
  getDevices(): Promise<Device[]>;
  getDevice(id: string): Promise<Device>;
  
  // Policies
  getPolicies(): Promise<Policy[]>;
  
  // Audit
  getAuditEntries(limit?: number): Promise<AuditEntry[]>;
  
  // Biometric Enrollment
  getFingerEnrollments(personId: string): Promise<FingerEnrollment[]>;
  
  // Sync
  getSyncState(): Promise<SyncState>;
}
