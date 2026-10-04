/**
 * Mock API Adapter — Authoritative Implementation
 * 
 * Implements BcamsApi using rich institutional mock data.
 * Supports scoped queries, academic enrollments, student eligibility,
 * same-lecturer session closure, and trusted physical endpoint lifecycles.
 */
import type { BcamsApi } from './types';
import type {
  FingerEnrollment, Student, AcademicEnrollment, Lecturer, Staff,
  Session, Device, Policy, Department, Course, CourseOffering,
  DailyClockRecord, AttendanceEvent, ClockEvent,
} from '@/types';
import {
  mockUsers, mockDepartments, mockCourses, mockCourseOfferings,
  mockStudents, mockAcademicEnrollments, mockLecturers, mockStaff,
  mockSessions, mockAttendanceEvents, mockClockEvents,
  mockDailyClockRecords, mockDevices, mockPolicies, mockAuditEntries,
  mockSyncState, mockDashboardStats, mockFingerEnrollments,
} from '@/mocks/data';
import { FINGER_POSITIONS } from '@/types';

const delay = (ms: number = 200) => new Promise(resolve => setTimeout(resolve, ms));

let currentUserId = 'user-sa';

// Mutable in-memory stores for interactive testing
let studentsStore = [...mockStudents];
let academicEnrollmentsStore = [...mockAcademicEnrollments];
let lecturersStore = [...mockLecturers];
let staffStore = [...mockStaff];
let sessionsStore = [...mockSessions];
let devicesStore = [...mockDevices];
let policiesStore = [...mockPolicies];
let departmentsStore = [...mockDepartments];
let coursesStore = [...mockCourses];
let clockRecordsStore = [...mockDailyClockRecords];

export function setMockUser(userId: string) {
  currentUserId = userId;
}

export const mockApi: BcamsApi = {
  async getCurrentUser() {
    await delay(50);
    return mockUsers[currentUserId] || mockUsers['user-sa'];
  },

  async getDashboardStats() {
    await delay(100);
    return mockDashboardStats;
  },

  async getDepartments() {
    await delay(100);
    return departmentsStore;
  },

  async getDepartment(id: string) {
    await delay(50);
    const dept = departmentsStore.find(d => d.id === id);
    if (!dept) throw new Error(`Department ${id} not found`);
    return dept;
  },

  async createDepartment(department: Partial<Department>) {
    await delay(150);
    const newDept: Department = {
      id: `dept-${Date.now().toString(36)}`,
      name: department.name || 'New Department',
      code: department.code || 'ND',
      studentCount: 0,
      lecturerCount: 0,
      staffCount: 0,
      courseCount: 0,
      ...department,
    };
    departmentsStore.push(newDept);
    return newDept;
  },

  async getCourses(departmentId?: string) {
    await delay(100);
    if (departmentId) {
      return coursesStore.filter(c => c.departmentId === departmentId || c.isGeneral);
    }
    return coursesStore;
  },

  async getCourseOfferings(departmentId?: string) {
    await delay(100);
    if (departmentId) {
      return mockCourseOfferings.filter(co => co.departmentId === departmentId);
    }
    return mockCourseOfferings;
  },

  /**
   * Student Course Eligibility:
   * Courses a student capturer is registered for according to academic enrollments.
   */
  async getEligibleCoursesForStudent(studentId: string) {
    await delay(100);
    const activeEnrollment = academicEnrollmentsStore.find(
      ae => ae.studentId === studentId && ae.status === 'active'
    );
    if (!activeEnrollment) {
      // Fallback to all CS courses for demonstration
      return mockCourseOfferings;
    }
    const enrolledCourseCodes = new Set(activeEnrollment.enrolledCourses.map(c => c.courseCode));
    const eligible = mockCourseOfferings.filter(co => enrolledCourseCodes.has(co.courseCode));
    return eligible.length > 0 ? eligible : mockCourseOfferings;
  },

  async createCourse(course: Partial<Course>) {
    await delay(150);
    const newCourse: Course = {
      id: `crs-${Date.now().toString(36)}`,
      code: course.code || 'NEW 101',
      title: course.title || 'Untitled Course',
      departmentId: course.departmentId || 'dept-cs',
      departmentName: course.departmentName || 'Computer Science',
      creditUnits: course.creditUnits || 3,
      isGeneral: course.isGeneral || false,
      level: course.level || 100,
      semester: course.semester || 1,
      ...course,
    };
    coursesStore.push(newCourse);
    return newCourse;
  },

  // ─── Students ─────────────────────────────────────────────────────────────

  async getStudents(departmentId?: string) {
    await delay(100);
    if (departmentId) {
      return studentsStore.filter(s => s.departmentId === departmentId);
    }
    return studentsStore;
  },

  async getStudent(id: string) {
    await delay(50);
    const student = studentsStore.find(s => s.id === id);
    if (!student) throw new Error(`Student ${id} not found`);
    return student;
  },

  async createStudent(student: Partial<Student>) {
    await delay(200);
    const newStudent: Student = {
      id: `stu-${Date.now().toString(36)}`,
      matricNumber: student.matricNumber || `CS/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`,
      fullName: student.fullName || 'New Student',
      specializations: ['student'],
      departmentId: student.departmentId || 'dept-cs',
      departmentName: student.departmentName || 'Computer Science',
      contactEmail: student.contactEmail,
      contactPhone: student.contactPhone,
      biometricStatus: 'not_enrolled',
      enrolledFingers: 0,
      lifecycleStatus: 'active',
      currentLevel: student.currentLevel || 100,
      currentProgramme: student.currentProgramme || 'B.Sc. Computer Science',
      currentSession: student.currentSession || '2026/2027',
      level: student.currentLevel || 100,
      programme: student.currentProgramme || 'B.Sc. Computer Science',
      academicSession: student.currentSession || '2026/2027',
      status: 'active',
      courseEnrollments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...student,
    };
    studentsStore.unshift(newStudent);

    // Automatically create initial Academic Enrollment record
    const academicSession = newStudent.currentSession || newStudent.academicSession || '2026/2027';
    const programme = newStudent.currentProgramme || newStudent.programme || 'Computer Science';
    const level = newStudent.currentLevel || newStudent.level || 100;
    const enrollment: AcademicEnrollment = {
      id: `ae-${newStudent.id}-${academicSession}`,
      studentId: newStudent.id,
      studentName: newStudent.fullName,
      matricNumber: newStudent.matricNumber,
      academicSession,
      departmentId: newStudent.departmentId,
      departmentName: newStudent.departmentName,
      programme,
      level,
      semester: 1,
      status: 'active',
      enrolledCourses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    academicEnrollmentsStore.unshift(enrollment);

    return newStudent;
  },

  async updateStudent(id: string, updates: Partial<Student>): Promise<Student> {
    await delay(100);
    const idx = studentsStore.findIndex(s => s.id === id);
    if (idx === -1) throw new Error(`Student ${id} not found`);
    studentsStore[idx] = {
      ...studentsStore[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return studentsStore[idx];
  },

  async bulkImportStudents(records: any[]) {
    await delay(400);
    let importedCount = 0;
    let updatedEnrollments = 0;
    const errors: any[] = [];

    for (const record of records) {
      if (!record.matricNumber || !record.fullName) {
        errors.push({ record, reason: 'Missing Matric Number or Full Name' });
        continue;
      }

      const existingIndex = studentsStore.findIndex(s => s.matricNumber.trim().toLowerCase() === record.matricNumber.trim().toLowerCase());

      if (existingIndex >= 0) {
        // Update existing student academic progression without corrupting past enrollment
        const existing = studentsStore[existingIndex];
        const newLevel = record.level ? Number(record.level) : (existing.currentLevel || existing.level || 100);
        const newSession = record.academicSession || existing.currentSession || existing.academicSession || '2026/2027';
        const prog = existing.currentProgramme || existing.programme || 'Computer Science';

        studentsStore[existingIndex] = {
          ...existing,
          currentLevel: newLevel,
          currentSession: newSession,
          level: newLevel,
          academicSession: newSession,
          updatedAt: new Date().toISOString(),
        };

        // Add new academic enrollment entry
        academicEnrollmentsStore.unshift({
          id: `ae-${existing.id}-${Date.now().toString(36)}`,
          studentId: existing.id,
          studentName: existing.fullName,
          matricNumber: existing.matricNumber,
          academicSession: newSession,
          departmentId: existing.departmentId,
          departmentName: existing.departmentName,
          programme: prog,
          level: newLevel,
          semester: record.semester ? Number(record.semester) : 1,
          status: 'active',
          enrolledCourses: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        updatedEnrollments++;
      } else {
        // Create new student
        const newSession = record.academicSession || '2026/2027';
        const prog = record.programme || 'B.Sc. Computer Science';
        const lvl = record.level ? Number(record.level) : 100;
        const newStudent: Student = {
          id: `stu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
          matricNumber: record.matricNumber.trim(),
          fullName: record.fullName.trim(),
          specializations: ['student'],
          departmentId: record.departmentId || 'dept-cs',
          departmentName: record.departmentName || 'Computer Science',
          contactEmail: record.contactEmail || `${record.matricNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.institution.edu.ng`,
          biometricStatus: 'not_enrolled',
          enrolledFingers: 0,
          lifecycleStatus: 'active',
          currentLevel: lvl,
          currentProgramme: prog,
          currentSession: newSession,
          level: lvl,
          programme: prog,
          academicSession: newSession,
          status: 'active',
          courseEnrollments: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        studentsStore.unshift(newStudent);
        academicEnrollmentsStore.unshift({
          id: `ae-${newStudent.id}-${newSession}`,
          studentId: newStudent.id,
          studentName: newStudent.fullName,
          matricNumber: newStudent.matricNumber,
          academicSession: newSession,
          departmentId: newStudent.departmentId,
          departmentName: newStudent.departmentName,
          programme: prog,
          level: lvl,
          semester: record.semester ? Number(record.semester) : 1,
          status: 'active',
          enrolledCourses: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        importedCount++;
      }
    }

    return { importedCount, updatedEnrollments, errors };
  },

  // ─── Academic Enrollments ───────────────────────────────────────────────────

  async getAcademicEnrollments(studentId?: string, departmentId?: string) {
    await delay(100);
    let list = academicEnrollmentsStore;
    if (studentId) {
      list = list.filter(ae => ae.studentId === studentId);
    }
    if (departmentId) {
      list = list.filter(ae => ae.departmentId === departmentId);
    }
    return list;
  },

  async createAcademicEnrollment(enrollment: Partial<AcademicEnrollment>) {
    await delay(150);
    const newEnrollment: AcademicEnrollment = {
      id: `ae-${Date.now().toString(36)}`,
      studentId: enrollment.studentId || '',
      studentName: enrollment.studentName || '',
      matricNumber: enrollment.matricNumber || '',
      academicSession: enrollment.academicSession || '2026/2027',
      departmentId: enrollment.departmentId || 'dept-cs',
      departmentName: enrollment.departmentName || 'Computer Science',
      programme: enrollment.programme || 'B.Sc. Computer Science',
      level: enrollment.level || 100,
      semester: enrollment.semester || 1,
      status: enrollment.status || 'active',
      enrolledCourses: enrollment.enrolledCourses || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    academicEnrollmentsStore.unshift(newEnrollment);

    // Update student's denormalized current fields
    const sIdx = studentsStore.findIndex(s => s.id === newEnrollment.studentId);
    if (sIdx >= 0) {
      studentsStore[sIdx] = {
        ...studentsStore[sIdx],
        currentLevel: newEnrollment.level,
        currentSession: newEnrollment.academicSession,
        level: newEnrollment.level,
        academicSession: newEnrollment.academicSession,
        updatedAt: new Date().toISOString(),
      };
    }

    return newEnrollment;
  },

  // ─── Staff & Lecturers ────────────────────────────────────────────────────

  async getStaff(departmentId?: string) {
    await delay(100);
    if (departmentId) {
      return staffStore.filter(s => s.departmentId === departmentId);
    }
    return staffStore;
  },

  async getStaffMember(id: string) {
    await delay(50);
    const staff = staffStore.find(s => s.id === id);
    if (!staff) throw new Error(`Staff member ${id} not found`);
    return staff;
  },

  async createStaff(staff: Partial<Staff>) {
    await delay(150);
    const newStaff: Staff = {
      id: `stf-${Date.now().toString(36)}`,
      staffId: staff.staffId || `STF/CS/${Math.floor(100 + Math.random() * 900)}`,
      fullName: staff.fullName || 'New Staff Member',
      designation: staff.designation || 'Staff',
      staffType: staff.staffType || 'non_academic',
      isLecturer: Boolean(staff.isLecturer),
      departmentId: staff.departmentId || 'dept-cs',
      departmentName: staff.departmentName || 'Computer Science',
      contactEmail: staff.contactEmail,
      contactPhone: staff.contactPhone,
      biometricStatus: 'not_enrolled',
      enrolledFingers: 0,
      specializations: staff.isLecturer ? ['staff', 'lecturer'] : ['staff'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...staff,
    };
    staffStore.unshift(newStaff);
    return newStaff;
  },

  async getLecturers(departmentId?: string) {
    await delay(100);
    if (departmentId) {
      return lecturersStore.filter(l => l.departmentId === departmentId);
    }
    return lecturersStore;
  },

  async getLecturer(id: string) {
    await delay(50);
    const lecturer = lecturersStore.find(l => l.id === id);
    if (!lecturer) throw new Error(`Lecturer ${id} not found`);
    return lecturer;
  },

  async createLecturer(lecturer: Partial<Lecturer>) {
    await delay(200);
    // If not already in staff store, register staff identity first
    let staffRecord = staffStore.find(s => s.staffId === lecturer.staffId);
    if (!staffRecord) {
      staffRecord = {
        id: `stf-${Date.now().toString(36)}`,
        staffId: lecturer.staffId || `STF/CS/${Math.floor(100 + Math.random() * 900)}`,
        fullName: lecturer.fullName || 'New Lecturer',
        designation: lecturer.designation || 'Lecturer',
        staffType: 'academic',
        isLecturer: true,
        departmentId: lecturer.departmentId || 'dept-cs',
        departmentName: lecturer.departmentName || 'Computer Science',
        contactEmail: lecturer.contactEmail,
        contactPhone: lecturer.contactPhone,
        biometricStatus: 'not_enrolled',
        enrolledFingers: 0,
        specializations: ['staff', 'lecturer'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      staffStore.unshift(staffRecord);
    } else {
      staffRecord.isLecturer = true;
      if (!staffRecord.specializations.includes('lecturer')) {
        staffRecord.specializations.push('lecturer');
      }
    }

    const newLecturer: Lecturer = {
      id: `lec-${Date.now().toString(36)}`,
      staffId: staffRecord.staffId,
      staffPersonId: staffRecord.id,
      fullName: lecturer.fullName || staffRecord.fullName,
      designation: lecturer.designation || staffRecord.designation,
      specializations: ['lecturer', 'staff'],
      departmentId: lecturer.departmentId || staffRecord.departmentId,
      departmentName: lecturer.departmentName || staffRecord.departmentName,
      contactEmail: lecturer.contactEmail || staffRecord.contactEmail,
      contactPhone: lecturer.contactPhone || staffRecord.contactPhone,
      biometricStatus: staffRecord.biometricStatus,
      enrolledFingers: staffRecord.enrolledFingers,
      assignedCourses: lecturer.assignedCourses || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...lecturer,
    };
    lecturersStore.unshift(newLecturer);
    return newLecturer;
  },

  async linkStaffToLecturer(staffId: string, lecturerData: Partial<Lecturer>) {
    await delay(150);
    const staff = staffStore.find(s => s.id === staffId || s.staffId === staffId);
    if (!staff) throw new Error(`Staff record ${staffId} not found`);

    staff.isLecturer = true;
    if (!staff.specializations.includes('lecturer')) {
      staff.specializations.push('lecturer');
    }

    const newLecturer: Lecturer = {
      id: `lec-${Date.now().toString(36)}`,
      staffId: staff.staffId,
      staffPersonId: staff.id,
      fullName: staff.fullName,
      designation: lecturerData.designation || staff.designation,
      specializations: ['lecturer', 'staff'],
      departmentId: staff.departmentId,
      departmentName: staff.departmentName,
      contactEmail: staff.contactEmail,
      contactPhone: staff.contactPhone,
      biometricStatus: staff.biometricStatus,
      enrolledFingers: staff.enrolledFingers,
      assignedCourses: lecturerData.assignedCourses || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    lecturersStore.unshift(newLecturer);
    return newLecturer;
  },

  // ─── Sessions ─────────────────────────────────────────────────────────────

  async getSessions(courseOfferingId?: string) {
    await delay(100);
    if (courseOfferingId) {
      return sessionsStore.filter(s => s.courseOfferingId === courseOfferingId);
    }
    return sessionsStore;
  },

  async getSession(id: string) {
    await delay(50);
    const session = sessionsStore.find(s => s.id === id);
    if (!session) throw new Error(`Session ${id} not found`);
    return session;
  },

  async createSession(session: Partial<Session>) {
    await delay(200);
    const newSession: Session = {
      id: `sess-${Date.now().toString(36)}`,
      courseOfferingId: session.courseOfferingId || 'co-csc201-2026',
      courseCode: session.courseCode || 'CSC 201',
      courseTitle: session.courseTitle || 'Computer Programming I',
      departmentId: session.departmentId || 'dept-cs',
      state: session.state || 'draft',
      venue: session.venue || 'Lecture Theatre 1',
      createdById: session.createdById || 'stu-capturer',
      createdByName: session.createdByName || 'Amina Ibrahim',
      lecturerId: session.lecturerId || 'lec-001',
      lecturerName: session.lecturerName || 'Dr. Emeka Nwosu',
      authorizationType: session.authorizationType || 'primary',
      substituteLecturerId: session.substituteLecturerId,
      substituteLecturerName: session.substituteLecturerName,
      maxDurationMinutes: 120,
      location: session.location || { latitude: 6.5244, longitude: 3.3792 },
      geofenceRadius: 200,
      attendanceCount: 0,
      enrolledCount: session.enrolledCount || 85,
      createdAt: new Date().toISOString(),
      ...session,
    };
    sessionsStore.unshift(newSession);
    return newSession;
  },

  async authorizeSession(sessionId: string, lecturerId: string) {
    await delay(150);
    const s = sessionsStore.find(x => x.id === sessionId);
    if (!s) throw new Error(`Session ${sessionId} not found`);

    const lec = lecturersStore.find(l => l.id === lecturerId);
    s.state = 'authorized';
    s.lecturerId = lecturerId;
    s.lecturerName = lec?.fullName || s.lecturerName;
    return { ...s };
  },

  async activateSession(sessionId: string) {
    await delay(150);
    const s = sessionsStore.find(x => x.id === sessionId);
    if (!s) throw new Error(`Session ${sessionId} not found`);
    s.state = 'active';
    s.actualStart = new Date().toISOString();
    return { ...s };
  },

  async closeSession(sessionId: string) {
    await delay(150);
    const s = sessionsStore.find(x => x.id === sessionId);
    if (!s) throw new Error(`Session ${sessionId} not found`);
    s.state = 'closed';
    s.actualEnd = new Date().toISOString();
    s.closureAuthorizedByLecturerId = s.lecturerId;
    return { ...s };
  },

  /**
   * Same-Lecturer Session Closure Verification (Rule 21):
   * Requires biometric scan of the SAME lecturer who authorized the session start!
   */
  async closeSessionWithLecturer(sessionId: string, lecturerFingerprintId: string) {
    await delay(300);
    const s = sessionsStore.find(x => x.id === sessionId);
    if (!s) return { success: false, error: 'Session not found' };

    // Find the authorizing lecturer ID
    const expectedLecturerId = s.lecturerId;

    if (lecturerFingerprintId !== expectedLecturerId) {
      const scannedLecturer = lecturersStore.find(l => l.id === lecturerFingerprintId);
      return {
        success: false,
        error: `Authorization Rejected: Session was authorized by ${s.lecturerName}. Closure must be biometrically authorized by the same lecturer, not ${scannedLecturer?.fullName || 'a different lecturer'}.`,
      };
    }

    s.state = 'closed';
    s.actualEnd = new Date().toISOString();
    s.closureAuthorizedByLecturerId = lecturerFingerprintId;
    return { success: true, session: { ...s } };
  },

  // ─── Attendance ───────────────────────────────────────────────────────────

  async getAttendanceEvents(sessionId: string) {
    await delay(100);
    return mockAttendanceEvents.filter(ae => ae.sessionId === sessionId);
  },

  async submitAttendanceCapture(event: Partial<AttendanceEvent>) {
    await delay(150);
    const newEvent: AttendanceEvent = {
      id: `ae-${Date.now().toString(36)}`,
      sessionId: event.sessionId || '',
      studentId: event.studentId || '',
      studentName: event.studentName || '',
      matricNumber: event.matricNumber || '',
      timestamp: new Date().toISOString(),
      deviceId: event.deviceId || 'dev-001',
      clockIntegrity: 'verified',
      syncStatus: 'synced',
      ...event,
    };
    mockAttendanceEvents.unshift(newEvent);

    // Increment session attendance count
    const s = sessionsStore.find(x => x.id === newEvent.sessionId);
    if (s) {
      s.attendanceCount += 1;
    }
    return newEvent;
  },

  // ─── Gate Records ─────────────────────────────────────────────────────────

  async getClockEvents(departmentId?: string, _date?: string) {
    await delay(100);
    if (departmentId) {
      const dept = departmentsStore.find(d => d.id === departmentId);
      if (dept) {
        return mockClockEvents.filter(ce => ce.staffDepartment === dept.name);
      }
    }
    return mockClockEvents;
  },

  async getDailyClockRecords(departmentId?: string, _date?: string) {
    await delay(100);
    if (departmentId) {
      const dept = departmentsStore.find(d => d.id === departmentId);
      if (dept) {
        return clockRecordsStore.filter(r => r.staffDepartment === dept.name);
      }
    }
    return clockRecordsStore;
  },

  async getGateRecords(filters?: { startDate?: string; endDate?: string; departmentId?: string; punctuality?: string }) {
    await delay(100);
    let records = [...clockRecordsStore];

    if (filters?.departmentId && filters.departmentId !== 'all') {
      const dept = departmentsStore.find(d => d.id === filters.departmentId);
      if (dept) {
        records = records.filter(r => r.staffDepartment === dept.name);
      }
    }

    if (filters?.startDate) {
      records = records.filter(r => r.date >= filters.startDate!);
    }

    if (filters?.endDate) {
      records = records.filter(r => r.date <= filters.endDate!);
    }

    if (filters?.punctuality && filters.punctuality !== 'all') {
      records = records.filter(r => r.clockIn?.punctuality === filters.punctuality);
    }

    return records;
  },

  async recordClockEvent(event: Partial<ClockEvent>) {
    await delay(150);
    const newEvent: ClockEvent = {
      id: `ce-${Date.now().toString(36)}`,
      staffId: event.staffId || 'STF/CS/001',
      staffName: event.staffName || 'Staff Member',
      staffDepartment: event.staffDepartment || 'Computer Science',
      type: event.type || 'clock_in',
      timestamp: new Date().toISOString(),
      punctuality: event.punctuality || 'on-time',
      deviceId: event.deviceId || 'dev-gate-01',
      clockIntegrity: 'verified',
      syncStatus: 'synced',
      ...event,
    };
    mockClockEvents.unshift(newEvent);
    return newEvent;
  },

  // ─── Devices (Trusted Endpoints) ──────────────────────────────────────────

  async getDevices() {
    await delay(100);
    return devicesStore;
  },

  async getDevice(id: string) {
    await delay(50);
    const dev = devicesStore.find(d => d.id === id);
    if (!dev) throw new Error(`Device ${id} not found`);
    return dev;
  },

  async registerDevice(device: Partial<Device>) {
    await delay(200);
    const newDevice: Device = {
      id: `dev-${Date.now().toString(36)}`,
      name: device.name || 'New Terminal',
      type: device.type || 'desktop_terminal',
      platform: device.platform || 'desktop',
      status: 'pending',
      lifecycleState: 'registered',
      serialNumber: device.serialNumber || `SN-${Date.now().toString(36).toUpperCase()}`,
      hardwareFingerprint: `SHA256:${Math.random().toString(36).slice(2, 10)}...`,
      assignedLocation: device.assignedLocation || 'Unassigned Location',
      assignedScope: device.assignedScope,
      registeredAt: new Date().toISOString(),
      pendingEvents: 0,
      scannerTransport: device.scannerTransport || 'usb',
      scannerModel: device.scannerModel || 'SecuGen Hamster Pro 20',
      scannerConnected: false,
      ...device,
    };
    devicesStore.unshift(newDevice);
    return newDevice;
  },

  async updateDeviceLifecycle(id: string, state: string, _notes?: string) {
    await delay(150);
    const dev = devicesStore.find(d => d.id === id);
    if (!dev) throw new Error(`Device ${id} not found`);

    dev.lifecycleState = state as any;
    if (state === 'active') {
      dev.status = 'active';
      dev.activatedAt = dev.activatedAt || new Date().toISOString();
    } else if (state === 'suspended') {
      dev.status = 'suspended';
    } else if (state === 'revoked') {
      dev.status = 'revoked';
    } else if (state === 'retired') {
      dev.status = 'retired';
    }
    return { ...dev };
  },

  // ─── Policies ─────────────────────────────────────────────────────────────

  async getPolicies() {
    await delay(100);
    return policiesStore;
  },

  async createPolicy(policy: Partial<Policy>) {
    await delay(150);
    const newPolicy: Policy = {
      id: `pol-${Date.now().toString(36)}`,
      type: policy.type || 'attendance_threshold',
      title: policy.title || 'Institutional Rule',
      description: policy.description || '',
      scope: policy.scope || 'institution',
      scopeId: policy.scopeId,
      scopeName: policy.scopeName,
      value: policy.value ?? 70,
      effectiveFrom: new Date().toISOString(),
      version: 'v1.0',
      createdBy: 'Super Administrator',
      isActive: true,
      ...policy,
    };
    policiesStore.unshift(newPolicy);
    return newPolicy;
  },

  // ─── Audit ────────────────────────────────────────────────────────────────

  async getAuditEntries(limit: number = 50) {
    await delay(100);
    return mockAuditEntries.slice(0, limit);
  },

  // ─── Biometrics ───────────────────────────────────────────────────────────

  async getFingerEnrollments(personId: string) {
    await delay(100);
    const enrollments = mockFingerEnrollments[personId];
    if (enrollments) return enrollments;
    return FINGER_POSITIONS.map(pos => ({
      position: pos,
      enrolled: false,
    } as FingerEnrollment));
  },

  async saveFingerEnrollment(personId: string, enrollment: Partial<FingerEnrollment>) {
    await delay(150);
    if (!mockFingerEnrollments[personId]) {
      mockFingerEnrollments[personId] = [];
    }
    const existingIdx = mockFingerEnrollments[personId].findIndex(f => f.position === enrollment.position);
    const entry: FingerEnrollment = {
      position: enrollment.position!,
      enrolled: true,
      enrolledAt: new Date().toISOString(),
      quality: enrollment.quality || 85,
    };
    if (existingIdx >= 0) {
      mockFingerEnrollments[personId][existingIdx] = entry;
    } else {
      mockFingerEnrollments[personId].push(entry);
    }
    return entry;
  },

  async getSyncState() {
    await delay(50);
    return mockSyncState;
  },
};
