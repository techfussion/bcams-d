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
  DailyClockRecord, AttendanceEvent, ClockEvent, User,
  AcademicSession, BulkProgressionPreview, BulkProgressionResult, BulkProgressionStudentPreview,
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
let academicSessionsStore: AcademicSession[] = [
  {
    id: 'sess-2024-2025',
    name: '2024/2025',
    startDate: '2024-09-01',
    endDate: '2025-07-31',
    isCurrent: false,
    currentSemester: 2,
    status: 'archived',
    createdAt: '2024-08-15T00:00:00Z',
  },
  {
    id: 'sess-2025-2026',
    name: '2025/2026',
    startDate: '2025-09-01',
    endDate: '2026-07-31',
    isCurrent: false,
    currentSemester: 2,
    status: 'archived',
    createdAt: '2025-08-15T00:00:00Z',
  },
  {
    id: 'sess-2026-2027',
    name: '2026/2027',
    startDate: '2026-09-01',
    endDate: '2027-07-31',
    isCurrent: true,
    currentSemester: 1,
    status: 'active',
    createdAt: '2026-08-15T00:00:00Z',
  },
];

function resolveLecturerIdentityIds(lecturerId?: string): Set<string> {
  const ids = new Set<string>();
  if (!lecturerId) return ids;
  ids.add(lecturerId);

  // Check matching lecturer in lecturersStore
  const targetLecturer = lecturersStore.find(
    l => l.id === lecturerId ||
         l.staffId === lecturerId ||
         l.staffPersonId === lecturerId ||
         (l.contactEmail && l.contactEmail.toLowerCase() === lecturerId.toLowerCase())
  );
  if (targetLecturer) {
    if (targetLecturer.id) ids.add(targetLecturer.id);
    if (targetLecturer.staffId) ids.add(targetLecturer.staffId);
    if (targetLecturer.staffPersonId) ids.add(targetLecturer.staffPersonId);
  }

  // Check user aliases
  const userMatch = Object.values(mockUsers).find(
    u => u.id === lecturerId || u.staffId === lecturerId || u.staffPersonId === lecturerId
  );
  if (userMatch) {
    ids.add(userMatch.id);
    if (userMatch.staffId) ids.add(userMatch.staffId);
    if (userMatch.staffPersonId) ids.add(userMatch.staffPersonId);

    const lecFromUser = lecturersStore.find(
      l => l.staffId === userMatch.staffId || l.staffPersonId === userMatch.staffPersonId
    );
    if (lecFromUser) {
      ids.add(lecFromUser.id);
      if (lecFromUser.staffId) ids.add(lecFromUser.staffId);
      if (lecFromUser.staffPersonId) ids.add(lecFromUser.staffPersonId);
    }
  }

  return ids;
}

export function setMockUser(userId: string) {
  currentUserId = userId;
}

export const mockApi: BcamsApi = {
  async getCurrentUser() {
    await delay(50);
    return mockUsers[currentUserId] || mockUsers['user-sa'];
  },

  async getDashboardStats(scope?: { departmentId?: string; isInstitutionWide?: boolean; lecturerId?: string; academicSession?: string }) {
    await delay(100);
    const deptId = scope?.departmentId;
    const isInst = scope?.isInstitutionWide ?? (!deptId && !scope?.lecturerId);
    const lecId = scope?.lecturerId;
    const academicSession = scope?.academicSession || '2026/2027';

    // Filter students
    const students = deptId ? studentsStore.filter(s => s.departmentId === deptId) : studentsStore;
    const totalStudents = students.length;
    const enrollmentComplete = students.filter(s => s.biometricStatus === 'complete').length;
    const enrollmentPartial = students.filter(s => s.biometricStatus === 'activated' || s.biometricStatus === 'partial').length;
    const enrollmentNone = students.filter(s => s.biometricStatus === 'not_enrolled').length;

    // Filter staff & lecturers
    const staff = deptId ? staffStore.filter(s => s.departmentId === deptId) : staffStore;
    const totalStaff = staff.length;
    const lecturers = deptId ? lecturersStore.filter(l => l.departmentId === deptId) : lecturersStore;
    const totalLecturers = lecturers.length;

    // Filter courses
    const courses = deptId ? coursesStore.filter(c => c.departmentId === deptId || c.isGeneral) : coursesStore;
    const totalCourses = courses.length;

    // Filter sessions
    let sessions = sessionsStore;
    if (academicSession && academicSession !== 'all') {
      sessions = sessions.filter(s => s.academicSession === academicSession);
    }
    if (lecId) {
      sessions = sessions.filter(s => s.lecturerId === lecId || s.substituteLecturerId === lecId);
    } else if (deptId) {
      sessions = sessions.filter(s => s.departmentId === deptId);
    }
    const activeSessions = sessions.filter(s => s.state === 'active').length;

    // Attendance today
    const todaySessions = sessions.filter(s => s.createdAt.startsWith('2026-10-04') || s.actualStart?.startsWith('2026-10-04'));
    const todayAttendance = todaySessions.reduce((acc, s) => acc + (s.attendanceCount || 0), 0);

    // Clock ins today
    const clockRecords = deptId
      ? clockRecordsStore.filter(c => c.staffDepartment.toLowerCase().includes(deptId.replace('dept-', '').toLowerCase()))
      : clockRecordsStore;
    const todayClockIns = clockRecords.filter(c => c.clockIn).length;

    // Average attendance rate
    const sessionsWithEnrolled = sessions.filter(s => s.enrolledCount > 0);
    const averageAttendanceRate = sessionsWithEnrolled.length > 0
      ? Math.round(sessionsWithEnrolled.reduce((acc, s) => acc + (s.attendanceCount / s.enrolledCount) * 100, 0) / sessionsWithEnrolled.length)
      : 78;

    return {
      departmentScoped: !isInst,
      departmentId: deptId,
      academicSession,
      totalStudents,
      enrolledStudents: enrollmentComplete + enrollmentPartial,
      enrollmentComplete,
      enrollmentPartial,
      enrollmentNone,
      activeSessions,
      totalCourses,
      totalStaff,
      totalLecturers,
      todayAttendance,
      todayClockIns,
      clockedInStaff: todayClockIns,
      activeDevices: isInst ? 3 : 1,
      devicesOnline: isInst ? 3 : 1,
      devicesTotal: isInst ? devicesStore.length : 2,
      pendingSyncEvents: lecId ? 0 : 2,
      averageAttendanceRate,
      belowThresholdStudents: 3,
    };
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

  async updateDepartment(id: string, updates: Partial<Department>): Promise<Department> {
    await delay(100);
    const idx = departmentsStore.findIndex(d => d.id === id);
    if (idx === -1) throw new Error(`Department ${id} not found`);
    departmentsStore[idx] = {
      ...departmentsStore[idx],
      ...updates,
    };
    return departmentsStore[idx];
  },

  async getCourses(departmentId?: string, lecturerId?: string) {
    await delay(100);
    let results = [...coursesStore];

    if (lecturerId) {
      const lecturerIds = resolveLecturerIdentityIds(lecturerId);
      results = results.filter(c => {
        const isPrimary = Boolean(c.primaryLecturerId && lecturerIds.has(c.primaryLecturerId));
        const isSub = Boolean(c.substituteLecturerId && lecturerIds.has(c.substituteLecturerId));
        const isOfferingAssigned = mockCourseOfferings.some(co => {
          if (co.courseId !== c.id && co.courseCode !== c.code) return false;
          if (co.primaryLecturerId && lecturerIds.has(co.primaryLecturerId)) return true;
          if (Array.isArray(co.assignedLecturers)) {
            return co.assignedLecturers.some(al =>
              typeof al === 'string' ? lecturerIds.has(al) : lecturerIds.has(al.lecturerId)
            );
          }
          return false;
        });
        const isLecturerAssigned = lecturersStore.some(l => {
          if (!lecturerIds.has(l.id)) return false;
          return l.assignedCourses?.some(ac => ac.courseId === c.id || ac.courseCode === c.code);
        });
        return isPrimary || isSub || isOfferingAssigned || isLecturerAssigned;
      });
    }

    if (departmentId) {
      results = results.filter(c => c.departmentId === departmentId || c.isGeneral);
    }

    return results;
  },

  async getCourseOfferings(departmentId?: string, lecturerId?: string) {
    await delay(100);
    let results = [...mockCourseOfferings];

    if (lecturerId) {
      const lecturerIds = resolveLecturerIdentityIds(lecturerId);
      results = results.filter(co => {
        if (co.primaryLecturerId && lecturerIds.has(co.primaryLecturerId)) return true;
        if (Array.isArray(co.assignedLecturers)) {
          return co.assignedLecturers.some(al =>
            typeof al === 'string' ? lecturerIds.has(al) : lecturerIds.has(al.lecturerId)
          );
        }
        return false;
      });
    }

    if (departmentId) {
      results = results.filter(co => co.departmentId === departmentId);
    }

    return results;
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

  async updateCourse(id: string, updates: Partial<Course>): Promise<Course> {
    await delay(100);
    const idx = coursesStore.findIndex(c => c.id === id);
    if (idx === -1) throw new Error(`Course ${id} not found`);
    coursesStore[idx] = {
      ...coursesStore[idx],
      ...updates,
    };
    return coursesStore[idx];
  },

  async bulkImportCourses(records: any[]) {
    await delay(300);
    const errors: Array<{ row: number; identifier: string; reason: string }> = [];
    let importedCount = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const row = record.rowNumber || i + 1;
      const code = (record.code || '').trim().toUpperCase();
      const title = (record.title || '').trim();

      if (!code || !title) {
        errors.push({
          row,
          identifier: code || 'UNKNOWN',
          reason: 'Course code and course title are required.',
        });
        continue;
      }

      const existing = coursesStore.find(
        c => c.code.trim().toUpperCase() === code
      );
      if (existing) {
        errors.push({
          row,
          identifier: code,
          reason: `Course with code "${code}" already exists in curriculum.`,
        });
        continue;
      }

      let deptId = record.departmentId || 'dept-cs';
      let deptName = record.departmentName || 'Computer Science';
      const isGeneral = Boolean(
        record.isGeneral ||
        (typeof record.is_general === 'string' &&
          (record.is_general.toLowerCase() === 'true' || record.is_general.toLowerCase() === 'yes'))
      );

      if (record.department) {
        const foundDept = departmentsStore.find(
          d => d.id.toLowerCase() === record.department.toLowerCase() ||
               d.code.toLowerCase() === record.department.toLowerCase() ||
               d.name.toLowerCase() === record.department.toLowerCase()
        );
        if (foundDept) {
          deptId = foundDept.id;
          deptName = foundDept.name;
        } else if (!isGeneral) {
          errors.push({
            row,
            identifier: code,
            reason: `Department "${record.department}" does not exist in registry.`,
          });
          continue;
        }
      } else if (record.departmentId && !isGeneral) {
        const foundDept = departmentsStore.find(
          d => d.id.toLowerCase() === record.departmentId.toLowerCase()
        );
        if (foundDept) {
          deptName = foundDept.name;
        } else {
          errors.push({
            row,
            identifier: code,
            reason: `Department ID "${record.departmentId}" does not exist in registry.`,
          });
          continue;
        }
      }

      const creditUnits = Number(record.creditUnits || record.units || 3);
      const level = Number(record.level || 100);
      const semester = Number(record.semester || 1);

      const newCourse: Course = {
        id: `crs-${code.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString(36)}`,
        code,
        title,
        departmentId: deptId,
        departmentName: deptName,
        creditUnits: isNaN(creditUnits) ? 3 : creditUnits,
        level: isNaN(level) ? 100 : level,
        semester: semester === 2 ? 2 : 1,
        isGeneral,
        status: 'active',
      };

      coursesStore.unshift(newCourse);
      importedCount++;
    }

    return { importedCount, errors };
  },

  async assignLecturerToCourse(
    courseId: string,
    lecturerIdOrPayload: string | { primaryLecturerId?: string; primaryLecturerName?: string; substituteLecturerId?: string; substituteLecturerName?: string },
    isPrimary?: boolean,
    isSubstitute?: boolean
  ): Promise<Course> {
    await delay(150);
    const idx = coursesStore.findIndex(c => c.id === courseId);
    if (idx === -1) throw new Error(`Course ${courseId} not found`);

    if (typeof lecturerIdOrPayload === 'object') {
      if (lecturerIdOrPayload.primaryLecturerId !== undefined) {
        coursesStore[idx].primaryLecturerId = lecturerIdOrPayload.primaryLecturerId;
        const lec = lecturersStore.find(l => l.id === lecturerIdOrPayload.primaryLecturerId);
        coursesStore[idx].primaryLecturerName = lecturerIdOrPayload.primaryLecturerName || lec?.fullName || 'Assigned Lecturer';
      }
      if (lecturerIdOrPayload.substituteLecturerId !== undefined) {
        coursesStore[idx].substituteLecturerId = lecturerIdOrPayload.substituteLecturerId;
        const lec = lecturersStore.find(l => l.id === lecturerIdOrPayload.substituteLecturerId);
        coursesStore[idx].substituteLecturerName = lecturerIdOrPayload.substituteLecturerName || lec?.fullName || 'Substitute Lecturer';
      }
      return coursesStore[idx];
    }

    const lecturerId = lecturerIdOrPayload;
    const lec = lecturersStore.find(l => l.id === lecturerId);
    if (!lec) throw new Error(`Lecturer ${lecturerId} not found`);

    if (isSubstitute) {
      coursesStore[idx].substituteLecturerId = lec.id;
      coursesStore[idx].substituteLecturerName = lec.fullName;
    } else {
      coursesStore[idx].primaryLecturerId = lec.id;
      coursesStore[idx].primaryLecturerName = lec.fullName;
    }
    return coursesStore[idx];
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

  async assignSessionCapturer(studentId: string, assign: boolean): Promise<{ student: Student; user?: User }> {
    await delay(150);
    const sIdx = studentsStore.findIndex(s => s.id === studentId || s.matricNumber === studentId);
    if (sIdx === -1) throw new Error(`Student ${studentId} not found`);

    const student = studentsStore[sIdx];
    const newCap = assign ? 'session_capture' : null;
    student.captureCapability = newCap;
    student.updatedAt = new Date().toISOString();

    // Sync with linked User record in mockUsers if exists
    let updatedUser: User | undefined;
    for (const key of Object.keys(mockUsers)) {
      const u = mockUsers[key];
      if (u.studentId === student.id || u.matricNumber === student.matricNumber) {
        u.captureCapability = newCap;
        updatedUser = u;
      }
    }

    return { student, user: updatedUser };
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

  async updateAcademicEnrollment(id: string, updates: Partial<AcademicEnrollment>): Promise<AcademicEnrollment> {
    await delay(100);
    const idx = academicEnrollmentsStore.findIndex(ae => ae.id === id);
    if (idx === -1) throw new Error(`Academic enrollment ${id} not found`);
    academicEnrollmentsStore[idx] = {
      ...academicEnrollmentsStore[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return academicEnrollmentsStore[idx];
  },

  // ─── Academic Sessions & Bulk Progression ───────────────────────────────────

  async getAcademicSessions(): Promise<AcademicSession[]> {
    await delay(100);
    return [...academicSessionsStore];
  },

  async createAcademicSession(session: Partial<AcademicSession>): Promise<AcademicSession> {
    await delay(150);
    if (!session.name || !/^\d{4}\/\d{4}$/.test(session.name.trim())) {
      throw new Error('Academic session name must match format YYYY/YYYY (e.g. 2026/2027)');
    }
    const cleanName = session.name.trim();
    const [y1, y2] = cleanName.split('/').map(Number);
    if (y2 !== y1 + 1) {
      throw new Error('Academic session must span consecutive years (e.g. 2026/2027)');
    }
    if (academicSessionsStore.some(s => s.name === cleanName)) {
      throw new Error(`Academic session ${cleanName} already exists`);
    }

    if (session.startDate && session.endDate && new Date(session.startDate) > new Date(session.endDate)) {
      throw new Error('Session start date must be before or equal to end date');
    }

    const isCurrent = Boolean(session.isCurrent);
    if (isCurrent) {
      academicSessionsStore.forEach(s => { s.isCurrent = false; });
    }

    const newSession: AcademicSession = {
      id: `sess-${cleanName.replace('/', '-')}`,
      name: cleanName,
      startDate: session.startDate,
      endDate: session.endDate,
      isCurrent,
      currentSemester: session.currentSemester || 1,
      status: isCurrent ? 'active' : 'upcoming',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    academicSessionsStore.unshift(newSession);
    return newSession;
  },

  async updateAcademicSession(id: string, updates: Partial<AcademicSession>): Promise<AcademicSession> {
    await delay(150);
    const idx = academicSessionsStore.findIndex(s => s.id === id);
    if (idx === -1) throw new Error(`Academic session ${id} not found`);

    if (updates.name && updates.name !== academicSessionsStore[idx].name) {
      const cleanName = updates.name.trim();
      if (!/^\d{4}\/\d{4}$/.test(cleanName)) {
        throw new Error('Academic session name must match format YYYY/YYYY (e.g. 2026/2027)');
      }
      if (academicSessionsStore.some(s => s.id !== id && s.name === cleanName)) {
        throw new Error(`Academic session ${cleanName} already exists`);
      }
      updates.name = cleanName;
    }

    if (updates.startDate && updates.endDate && new Date(updates.startDate) > new Date(updates.endDate)) {
      throw new Error('Session start date must be before or equal to end date');
    }

    if (updates.isCurrent) {
      academicSessionsStore.forEach(s => {
        if (s.id !== id) s.isCurrent = false;
      });
    }

    academicSessionsStore[idx] = {
      ...academicSessionsStore[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    return academicSessionsStore[idx];
  },

  async setCurrentAcademicSession(id: string, semester?: 1 | 2): Promise<AcademicSession> {
    await delay(150);
    const idx = academicSessionsStore.findIndex(s => s.id === id);
    if (idx === -1) throw new Error(`Academic session ${id} not found`);

    academicSessionsStore.forEach(s => {
      s.isCurrent = s.id === id;
      if (s.id === id) {
        s.status = 'active';
        if (semester) s.currentSemester = semester;
      }
    });

    academicSessionsStore[idx].updatedAt = new Date().toISOString();
    return academicSessionsStore[idx];
  },

  async previewBulkProgression(targetSession: string, targetSemester: number): Promise<BulkProgressionPreview> {
    await delay(200);
    const cleanSession = targetSession.trim();
    const students: BulkProgressionStudentPreview[] = [];
    let eligibleCount = 0;
    let alreadyProgressedCount = 0;
    let excludedCount = 0;

    for (const s of studentsStore) {
      const status = s.lifecycleStatus || s.status || 'active';
      const isExcluded = status === 'graduated' || status === 'withdrawn' || status === 'suspended';

      // Duplicate prevention: check if student already has an enrollment for targetSession AND targetSemester
      const alreadyHasEnrollment = academicEnrollmentsStore.some(
        ae => ae.studentId === s.id && ae.academicSession === cleanSession && ae.semester === targetSemester
      );

      const currentLvl = s.currentLevel || s.level || 100;
      const currentSess = s.currentSession || s.academicSession || '2026/2027';

      let targetLvl = currentLvl;
      if (targetSemester === 1 && cleanSession !== currentSess) {
        targetLvl = Math.min(currentLvl + 100, 500);
      }

      if (isExcluded) {
        excludedCount++;
        students.push({
          studentId: s.id,
          studentName: s.fullName,
          matricNumber: s.matricNumber,
          departmentId: s.departmentId,
          departmentName: s.departmentName,
          currentLevel: currentLvl,
          currentSession: currentSess,
          targetLevel: targetLvl,
          targetSession: cleanSession,
          targetSemester,
          eligible: false,
          status: 'excluded_status',
          reason: `Student status is ${status}`,
        });
      } else if (alreadyHasEnrollment) {
        alreadyProgressedCount++;
        students.push({
          studentId: s.id,
          studentName: s.fullName,
          matricNumber: s.matricNumber,
          departmentId: s.departmentId,
          departmentName: s.departmentName,
          currentLevel: currentLvl,
          currentSession: currentSess,
          targetLevel: targetLvl,
          targetSession: cleanSession,
          targetSemester,
          eligible: false,
          status: 'already_progressed',
          reason: `Already enrolled in ${cleanSession} Semester ${targetSemester}`,
        });
      } else {
        eligibleCount++;
        students.push({
          studentId: s.id,
          studentName: s.fullName,
          matricNumber: s.matricNumber,
          departmentId: s.departmentId,
          departmentName: s.departmentName,
          currentLevel: currentLvl,
          currentSession: currentSess,
          targetLevel: targetLvl,
          targetSession: cleanSession,
          targetSemester,
          eligible: true,
          status: 'eligible',
        });
      }
    }

    return {
      targetSession: cleanSession,
      targetSemester,
      totalStudents: studentsStore.length,
      eligibleCount,
      alreadyProgressedCount,
      excludedCount,
      students,
    };
  },

  async executeBulkProgression(targetSession: string, targetSemester: number): Promise<BulkProgressionResult> {
    await delay(300);
    const cleanSession = targetSession.trim();
    const preview = await this.previewBulkProgression(cleanSession, targetSemester);
    const details: BulkProgressionResult['details'] = [];
    let successfulCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const item of preview.students) {
      if (!item.eligible) {
        skippedCount++;
        details.push({
          studentId: item.studentId,
          studentName: item.studentName,
          matricNumber: item.matricNumber,
          status: 'skipped',
          reason: item.reason,
        });
        continue;
      }

      try {
        const studentIndex = studentsStore.findIndex(s => s.id === item.studentId);
        if (studentIndex === -1) {
          failedCount++;
          details.push({
            studentId: item.studentId,
            studentName: item.studentName,
            matricNumber: item.matricNumber,
            status: 'failed',
            reason: 'Student record not found in registry',
          });
          continue;
        }

        const student = studentsStore[studentIndex];

        // 1. Complete prior active enrollment
        for (const ae of academicEnrollmentsStore) {
          if (ae.studentId === student.id && ae.status === 'active') {
            ae.status = 'completed';
            ae.updatedAt = new Date().toISOString();
          }
        }

        // 2. Append new enrollment for target session and semester
        const newEnrollment: AcademicEnrollment = {
          id: `ae-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          studentId: student.id,
          studentName: student.fullName,
          matricNumber: student.matricNumber,
          academicSession: cleanSession,
          departmentId: student.departmentId,
          departmentName: student.departmentName,
          programme: student.currentProgramme || student.programme || 'Undergraduate',
          level: item.targetLevel,
          semester: targetSemester,
          status: 'active',
          enrolledCourses: student.courseEnrollments || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        academicEnrollmentsStore.unshift(newEnrollment);

        // 3. Update student's denormalized fields consistently
        studentsStore[studentIndex] = {
          ...student,
          currentLevel: item.targetLevel,
          level: item.targetLevel,
          currentSession: cleanSession,
          academicSession: cleanSession,
          updatedAt: new Date().toISOString(),
        };

        successfulCount++;
        details.push({
          studentId: student.id,
          studentName: student.fullName,
          matricNumber: student.matricNumber,
          status: 'success',
        });
      } catch (err: any) {
        failedCount++;
        details.push({
          studentId: item.studentId,
          studentName: item.studentName,
          matricNumber: item.matricNumber,
          status: 'failed',
          reason: err?.message || 'Progression transaction error',
        });
      }
    }

    return {
      targetSession: cleanSession,
      targetSemester,
      totalProcessed: preview.students.length,
      successfulCount,
      skippedCount,
      failedCount,
      details,
    };
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

  async updateStaff(id: string, updates: Partial<Staff>): Promise<Staff> {
    await delay(100);
    const idx = staffStore.findIndex(s => s.id === id);
    if (idx === -1) throw new Error(`Staff member ${id} not found`);
    staffStore[idx] = {
      ...staffStore[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    // If isLecturer was toggled on and no lecturer record exists, auto create lecturer
    if (updates.isLecturer && !lecturersStore.some(l => l.staffPersonId === id || l.staffId === staffStore[idx].staffId)) {
      lecturersStore.unshift({
        id: `lec-${Date.now().toString(36)}`,
        staffId: staffStore[idx].staffId,
        staffPersonId: staffStore[idx].id,
        fullName: staffStore[idx].fullName,
        designation: staffStore[idx].designation,
        specializations: ['lecturer', 'staff'],
        departmentId: staffStore[idx].departmentId,
        departmentName: staffStore[idx].departmentName,
        contactEmail: staffStore[idx].contactEmail,
        contactPhone: staffStore[idx].contactPhone,
        biometricStatus: staffStore[idx].biometricStatus,
        enrolledFingers: staffStore[idx].enrolledFingers,
        assignedCourses: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Sync biometric enrollment with linked lecturer record
    const lecIdx = lecturersStore.findIndex(l => l.staffPersonId === id || l.staffId === staffStore[idx].staffId);
    if (lecIdx !== -1) {
      if (updates.biometricStatus !== undefined) lecturersStore[lecIdx].biometricStatus = updates.biometricStatus;
      if (updates.enrolledFingers !== undefined) lecturersStore[lecIdx].enrolledFingers = updates.enrolledFingers;
    }

    return staffStore[idx];
  },

  async bulkImportStaff(records: any[]) {
    await delay(300);
    let importedCount = 0;
    const errors: any[] = [];

    for (const record of records) {
      if (!record.staffId || !record.fullName) {
        errors.push({ record, reason: 'Missing Staff ID or Full Name' });
        continue;
      }

      const existingIndex = staffStore.findIndex(
        s => s.staffId.trim().toLowerCase() === record.staffId.trim().toLowerCase()
      );

      if (existingIndex >= 0) {
        errors.push({ record, reason: `Staff ID ${record.staffId} already exists in registry` });
        continue;
      }

      const newStaff: Staff = {
        id: `stf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        staffId: record.staffId.trim(),
        fullName: record.fullName.trim(),
        designation: record.designation || 'Staff Member',
        staffType: record.staffType === 'academic' ? 'academic' : 'non_academic',
        isLecturer: record.staffType === 'academic' || Boolean(record.isLecturer),
        departmentId: record.departmentId || 'dept-cs',
        departmentName: record.departmentName || 'Computer Science',
        contactEmail: record.contactEmail || `${record.staffId.toLowerCase().replace(/[^a-z0-9]/g, '')}@institution.edu.ng`,
        contactPhone: record.contactPhone,
        biometricStatus: 'not_enrolled',
        enrolledFingers: 0,
        specializations: record.staffType === 'academic' ? ['staff', 'lecturer'] : ['staff'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      staffStore.unshift(newStaff);
      importedCount++;
    }

    return { importedCount, errors };
  },

  async bulkImportLecturers(records: any[]) {
    await delay(300);
    let importedCount = 0;
    const errors: any[] = [];

    for (const record of records) {
      if (!record.staffId || !record.fullName) {
        errors.push({ record, reason: 'Missing Staff ID or Full Name' });
        continue;
      }

      // Check if lecturer already exists in lecturers store
      const existingLecIndex = lecturersStore.findIndex(
        l => l.staffId.trim().toLowerCase() === record.staffId.trim().toLowerCase()
      );

      if (existingLecIndex >= 0) {
        errors.push({ record, reason: `Lecturer with Staff ID ${record.staffId} already exists in registry` });
        continue;
      }

      // Maintain Person -> Staff -> Lecturer identity hierarchy
      let staffRecord = staffStore.find(
        s => s.staffId.trim().toLowerCase() === record.staffId.trim().toLowerCase()
      );

      if (staffRecord) {
        // Link existing staff member
        staffRecord.isLecturer = true;
        if (!staffRecord.specializations.includes('lecturer')) {
          staffRecord.specializations.push('lecturer');
        }
        staffRecord.updatedAt = new Date().toISOString();
      } else {
        // Create underlying staff identity first to prevent orphan lecturer records
        staffRecord = {
          id: `stf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
          staffId: record.staffId.trim(),
          fullName: record.fullName.trim(),
          designation: record.designation?.trim() || 'Lecturer',
          staffType: 'academic',
          isLecturer: true,
          departmentId: record.departmentId || 'dept-cs',
          departmentName: record.departmentName || 'Computer Science',
          contactEmail: record.contactEmail || `${record.staffId.toLowerCase().replace(/[^a-z0-9]/g, '')}@institution.edu.ng`,
          contactPhone: record.contactPhone,
          biometricStatus: 'not_enrolled',
          enrolledFingers: 0,
          specializations: ['staff', 'lecturer'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        staffStore.unshift(staffRecord);
      }

      const newLecturer: Lecturer = {
        id: `lec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        staffId: staffRecord.staffId,
        staffPersonId: staffRecord.id,
        fullName: record.fullName.trim() || staffRecord.fullName,
        designation: record.designation?.trim() || staffRecord.designation,
        specializations: ['lecturer', 'staff'],
        departmentId: record.departmentId || staffRecord.departmentId,
        departmentName: record.departmentName || staffRecord.departmentName,
        contactEmail: record.contactEmail || staffRecord.contactEmail,
        contactPhone: record.contactPhone || staffRecord.contactPhone,
        biometricStatus: staffRecord.biometricStatus,
        enrolledFingers: staffRecord.enrolledFingers,
        assignedCourses: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      lecturersStore.unshift(newLecturer);
      importedCount++;
    }

    return { importedCount, errors };
  },

  async assignHOD(staffId: string, departmentId: string, remove?: boolean): Promise<Staff> {
    await delay(150);
    const dept = departmentsStore.find(d => d.id === departmentId);
    if (!dept && !remove) throw new Error(`Department ${departmentId} not found`);
    const idx = staffStore.findIndex(s => s.id === staffId || s.staffId === staffId);

    if (remove) {
      if (idx !== -1) {
        staffStore[idx].isHOD = false;
        staffStore[idx].hodDepartmentId = undefined;
        staffStore[idx].hodDepartmentName = undefined;
        staffStore[idx].updatedAt = new Date().toISOString();

        // Sync with mockUsers if linked
        for (const key of Object.keys(mockUsers)) {
          const u = mockUsers[key];
          if (u.staffPersonId === staffStore[idx].id || u.staffId === staffStore[idx].staffId) {
            u.isHOD = false;
          }
        }
      }
      if (dept) {
        // Also clear staff who held HOD on dept
        const prevStaff = staffStore.find(s => s.id === dept.hodId || (dept.hodName && s.fullName === dept.hodName));
        if (prevStaff) {
          prevStaff.isHOD = false;
          prevStaff.hodDepartmentId = undefined;
          prevStaff.hodDepartmentName = undefined;
          prevStaff.updatedAt = new Date().toISOString();
        }
        dept.hodId = undefined;
        dept.hodName = undefined;
      }
      return idx !== -1 ? staffStore[idx] : ({} as Staff);
    }

    if (idx === -1) throw new Error(`Staff member ${staffId} not found`);
    if (!dept) throw new Error(`Department ${departmentId} not found`);

    // If replacing an existing HOD in this department, clear previous HOD's flags
    if (dept.hodId && dept.hodId !== staffStore[idx].id) {
      const prevHod = staffStore.find(s => s.id === dept.hodId || (dept.hodName && s.fullName === dept.hodName));
      if (prevHod) {
        prevHod.isHOD = false;
        prevHod.hodDepartmentId = undefined;
        prevHod.hodDepartmentName = undefined;
        prevHod.updatedAt = new Date().toISOString();
        for (const key of Object.keys(mockUsers)) {
          const u = mockUsers[key];
          if (u.staffPersonId === prevHod.id || u.staffId === prevHod.staffId) {
            u.isHOD = false;
          }
        }
      }
    }

    // If this staff member was previously HOD of another department, clear that department
    if (staffStore[idx].hodDepartmentId && staffStore[idx].hodDepartmentId !== dept.id) {
      const oldDept = departmentsStore.find(d => d.id === staffStore[idx].hodDepartmentId);
      if (oldDept) {
        oldDept.hodId = undefined;
        oldDept.hodName = undefined;
      }
    }

    staffStore[idx].isHOD = true;
    staffStore[idx].hodDepartmentId = dept.id;
    staffStore[idx].hodDepartmentName = dept.name;
    staffStore[idx].updatedAt = new Date().toISOString();

    dept.hodId = staffStore[idx].id;
    dept.hodName = staffStore[idx].fullName;

    // Sync with mockUsers
    for (const key of Object.keys(mockUsers)) {
      const u = mockUsers[key];
      if (u.staffPersonId === staffStore[idx].id || u.staffId === staffStore[idx].staffId) {
        u.isHOD = true;
        u.departmentId = dept.id;
        u.departmentName = dept.name;
      }
    }

    return staffStore[idx];
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

  async updateLecturer(id: string, updates: Partial<Lecturer>): Promise<Lecturer> {
    await delay(100);
    const idx = lecturersStore.findIndex(l => l.id === id);
    if (idx === -1) throw new Error(`Lecturer ${id} not found`);
    lecturersStore[idx] = {
      ...lecturersStore[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    // Sync with staff store if linked
    const staffId = lecturersStore[idx].staffPersonId || lecturersStore[idx].staffId;
    const sIdx = staffStore.findIndex(s => s.id === staffId || s.staffId === staffId);
    if (sIdx >= 0) {
      if (updates.fullName) staffStore[sIdx].fullName = updates.fullName;
      if (updates.biometricStatus !== undefined) staffStore[sIdx].biometricStatus = updates.biometricStatus;
      if (updates.enrolledFingers !== undefined) staffStore[sIdx].enrolledFingers = updates.enrolledFingers;
    }
    return lecturersStore[idx];
  },

  // ─── Sessions ─────────────────────────────────────────────────────────────

  async getSessions(courseOfferingId?: string, lecturerId?: string) {
    await delay(100);
    let results = [...sessionsStore];

    if (lecturerId) {
      const lecturerIds = resolveLecturerIdentityIds(lecturerId);
      const assignedOfferings = mockCourseOfferings.filter(co => {
        if (co.primaryLecturerId && lecturerIds.has(co.primaryLecturerId)) return true;
        if (Array.isArray(co.assignedLecturers)) {
          return co.assignedLecturers.some(al =>
            typeof al === 'string' ? lecturerIds.has(al) : lecturerIds.has(al.lecturerId)
          );
        }
        return false;
      });
      const assignedOfferingIds = new Set(assignedOfferings.map(o => o.id));
      const assignedCourseCodes = new Set([
        ...assignedOfferings.map(o => o.courseCode),
        ...coursesStore
          .filter(c => (c.primaryLecturerId && lecturerIds.has(c.primaryLecturerId)) || (c.substituteLecturerId && lecturerIds.has(c.substituteLecturerId)))
          .map(c => c.code),
      ]);

      results = results.filter(s => {
        if (s.lecturerId && lecturerIds.has(s.lecturerId)) return true;
        if (s.courseOfferingId && assignedOfferingIds.has(s.courseOfferingId)) return true;
        if (s.courseCode && assignedCourseCodes.has(s.courseCode)) return true;
        return false;
      });
    }

    if (courseOfferingId) {
      results = results.filter(s => s.courseOfferingId === courseOfferingId || s.departmentId === courseOfferingId);
    }
    return results;
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
      departmentName: session.departmentName || 'Computer Science',
      academicSession: session.academicSession || '2026/2027',
      semester: session.semester || 1,
      state: session.state || 'active',
      status: session.status || 'active',
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
      startTime: session.startTime || new Date().toISOString(),
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
    return [...policiesStore];
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

  async updatePolicy(id: string, updates: Partial<Policy>): Promise<Policy> {
    await delay(100);
    const idx = policiesStore.findIndex(p => p.id === id);
    if (idx === -1) throw new Error(`Policy ${id} not found`);
    policiesStore[idx] = {
      ...policiesStore[idx],
      ...updates,
      effectiveFrom: new Date().toISOString(),
    };
    return policiesStore[idx];
  },

  async saveInstitutionalPolicies(policies: Partial<Policy>[]): Promise<Policy[]> {
    await delay(150);
    const saved: Policy[] = [];
    for (const p of policies) {
      if (p.id) {
        const idx = policiesStore.findIndex(pol => pol.id === p.id);
        if (idx !== -1) {
          policiesStore[idx] = {
            ...policiesStore[idx],
            ...p,
            scope: 'institution',
            effectiveFrom: new Date().toISOString(),
          };
          saved.push(policiesStore[idx]);
          continue;
        }
      }
      // Match by type with institution scope
      const existingIdx = policiesStore.findIndex(
        pol => pol.type === p.type && (pol.scope === 'institution' || !pol.scopeId)
      );
      if (existingIdx !== -1) {
        policiesStore[existingIdx] = {
          ...policiesStore[existingIdx],
          ...p,
          scope: 'institution',
          effectiveFrom: new Date().toISOString(),
        };
        saved.push(policiesStore[existingIdx]);
      } else {
        const created = await this.createPolicy({ ...p, scope: 'institution' });
        saved.push(created);
      }
    }
    return saved;
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
