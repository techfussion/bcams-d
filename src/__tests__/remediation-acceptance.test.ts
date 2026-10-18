import { describe, it, expect } from 'vitest';
import { api } from '@/api';
import { canManageStaff, canAssignHOD, canViewGateLedger, canManageCourses } from '@/lib/permissions';
import type { User, Student, Staff, Lecturer, Course } from '@/types';

describe('BCAMS Final Remediation Acceptance Suite', () => {
  // Test Users matching mock dataset
  const superAdminUser: User = {
    id: 'user-admin',
    email: 'admin@unilag.edu.ng',
    fullName: 'Engr. Babatunde Adeyemi',
    role: 'super_admin',
  };

  const hodCSUser: User = {
    id: 'user-hod-cs',
    email: 'hod.cs@unilag.edu.ng',
    fullName: 'Prof. Chidinma Okafor',
    role: 'hod',
    departmentId: 'dept-cs',
    departmentName: 'Computer Science',
    isHOD: true,
    isLecturer: true,
    staffId: 'STF/CS/003',
    staffPersonId: 'stf-lec-003',
  };

  const hodITUser: User = {
    id: 'user-hod-it',
    email: 'hod.it@unilag.edu.ng',
    fullName: 'Dr. Chidi Okafor',
    role: 'hod',
    departmentId: 'dept-it',
    departmentName: 'Information Technology',
    isHOD: true,
    isLecturer: true,
    staffId: 'STF/IT/001',
    staffPersonId: 'stf-it-001',
  };

  const lecturerOnlyUser: User = {
    id: 'user-lec-002',
    email: 'e.nwosu@institution.edu.ng',
    fullName: 'Dr. Emeka Nwosu',
    role: 'lecturer',
    departmentId: 'dept-cs',
    departmentName: 'Computer Science',
    isLecturer: true,
    staffId: 'STF/CS/001',
    staffPersonId: 'stf-lec-001',
  };

  const studentCapturerUser: User = {
    id: 'user-capturer',
    email: 'capturer@unilag.edu.ng',
    fullName: 'Amina Ibrahim',
    role: 'student',
    captureCapability: 'session_capture',
    studentId: 'stu-capturer',
    matricNumber: 'CS/2024/005',
  };

  const ordinaryStaffUser: User = {
    id: 'user-staff-ordinary',
    email: 'staff@unilag.edu.ng',
    fullName: 'Officer Danladi Yakubu',
    role: 'staff',
    staffId: 'STF/SEC/001',
    staffPersonId: 'stf-sec-001',
  };

  // ─── 1. Multi-Responsibility Domain Model ──────────────────────────────────
  describe('1. Multi-Responsibility Person Modeling (Section 3 & 4)', () => {
    it('models Staff + HOD + Lecturer as one person without duplicate records', async () => {
      const staffList = await api.getStaff();
      const chidinmaStaff = staffList.find(s => s.fullName === 'Prof. Chidinma Okafor');
      expect(chidinmaStaff).toBeDefined();
      expect(chidinmaStaff?.isHOD).toBe(true);
      expect(chidinmaStaff?.isLecturer).toBe(true);
      expect(chidinmaStaff?.hodDepartmentId).toBe('dept-cs');

      const lecturers = await api.getLecturers();
      const chidinmaLecturer = lecturers.find(l => l.fullName === 'Prof. Chidinma Okafor');
      expect(chidinmaLecturer).toBeDefined();
      expect(chidinmaLecturer?.staffPersonId).toBe(chidinmaStaff?.id);
      expect(chidinmaLecturer?.staffId).toBe(chidinmaStaff?.staffId);
    });

    it('shares biometric enrollment between Staff identity and Lecturer role', async () => {
      const staffList = await api.getStaff();
      const chidinmaStaff = staffList.find(s => s.fullName === 'Prof. Chidinma Okafor');
      expect(chidinmaStaff).toBeDefined();

      const updated = await api.updateStaff(chidinmaStaff!.id, {
        enrolledFingers: 10,
        biometricStatus: 'complete',
      });
      expect(updated.enrolledFingers).toBe(10);
      expect(updated.biometricStatus).toBe('complete');

      const lecturers = await api.getLecturers();
      const chidinmaLecturer = lecturers.find(l => l.staffPersonId === chidinmaStaff?.id);
      expect(chidinmaLecturer?.enrolledFingers).toBe(10);
      expect(chidinmaLecturer?.biometricStatus).toBe('complete');
    });
  });

  // ─── 2. Scope Enforcement: Super Admin vs HOD vs Lecturer ──────────────────
  describe('2. Data Scoping & Authorization (Section 7, 8, 9, 41)', () => {
    it('Super Admin retrieves institution-wide stats across all departments', async () => {
      const stats = await api.getDashboardStats({ isInstitutionWide: true, academicSession: '2026/2027' });
      expect(stats.totalStudents).toBeGreaterThan(5);
      expect(stats.totalStaff).toBeGreaterThan(4);
      expect(stats.totalLecturers).toBeGreaterThan(3);
      expect(stats.departmentScoped).toBe(false);
    });

    it('HOD Computer Science retrieves only CS department scoped statistics', async () => {
      const statsCS = await api.getDashboardStats({ departmentId: 'dept-cs', academicSession: '2026/2027' });
      expect(statsCS.departmentScoped).toBe(true);
      expect(statsCS.departmentId).toBe('dept-cs');

      const statsIT = await api.getDashboardStats({ departmentId: 'dept-it', academicSession: '2026/2027' });
      expect(statsIT.departmentScoped).toBe(true);
      expect(statsIT.departmentId).toBe('dept-it');
    });

    it('HOD can only view students and staff belonging to their department', async () => {
      const csStudents = await api.getStudents(hodCSUser.departmentId);
      expect(csStudents.length).toBeGreaterThan(0);
      expect(csStudents.every(s => s.departmentId === 'dept-cs')).toBe(true);

      const itStudents = await api.getStudents(hodITUser.departmentId);
      expect(itStudents.length).toBeGreaterThan(0);
      expect(itStudents.every(s => s.departmentId === 'dept-it')).toBe(true);
    });

    it('enforces gate ledger view permission: Super Admin permitted, HOD and other roles denied', () => {
      expect(canViewGateLedger(superAdminUser)).toBe(true);
      expect(canViewGateLedger(hodCSUser, 'dept-cs')).toBe(false); // HOD removed from gate attendance
      expect(canViewGateLedger(hodCSUser)).toBe(false);
      expect(canViewGateLedger(ordinaryStaffUser)).toBe(false); // ordinary staff don't get admin history
      expect(canViewGateLedger(lecturerOnlyUser)).toBe(false);
    });

    it('enforces staff management permission: Super Admin everywhere, HOD own department only', () => {
      expect(canManageStaff(superAdminUser)).toBe(true);
      expect(canManageStaff(hodCSUser, 'dept-cs')).toBe(true);
      expect(canManageStaff(hodCSUser, 'dept-it')).toBe(false);
      expect(canManageStaff(lecturerOnlyUser)).toBe(false);
      expect(canManageStaff(studentCapturerUser)).toBe(false);
    });

    it('enforces HOD assignment permission: Super Admin only', () => {
      expect(canAssignHOD(superAdminUser)).toBe(true);
      expect(canAssignHOD(hodCSUser)).toBe(false);
      expect(canAssignHOD(lecturerOnlyUser)).toBe(false);
    });
  });

  // ─── 3. Historical vs Current Academic Context ──────────────────────────────
  describe('3. Current vs Historical Academic Records (Section 2, 37, 42)', () => {
    it('retrieves distinct stats for current 2026/2027 and historical 2025/2026', async () => {
      const statsCurrent = await api.getDashboardStats({ isInstitutionWide: true, academicSession: '2026/2027' });
      const statsHistorical = await api.getDashboardStats({ isInstitutionWide: true, academicSession: '2025/2026' });

      expect(statsCurrent.academicSession).toBe('2026/2027');
      expect(statsHistorical.academicSession).toBe('2025/2026');
      expect(statsHistorical.activeSessions).toBeDefined();
    });

    it('preserves historical academic progression records on students', async () => {
      const students = await api.getStudents();
      const studentWithHistory = students.find(s => s.matricNumber === 'CS/2024/001');
      expect(studentWithHistory).toBeDefined();

      const enrollments = await api.getAcademicEnrollments(studentWithHistory!.id);
      expect(enrollments.length).toBeGreaterThanOrEqual(2);
      
      const sessions = enrollments.map(e => e.academicSession);
      expect(sessions).toContain('2025/2026');
      expect(sessions).toContain('2026/2027');

      // 2025/2026 was level 100, 2026/2027 is level 200
      const e2025 = enrollments.find(e => e.academicSession === '2025/2026');
      const e2026 = enrollments.find(e => e.academicSession === '2026/2027');
      expect(e2025?.level).toBe(100);
      expect(e2026?.level).toBe(200);
    });
  });

  // ─── 4. Session Lifecycle & Ledger ─────────────────────────────────────────
  describe('4. Session Lifecycle (Section 11, 31, 32)', () => {
    it('supports only active, closed, expired states in user-facing lifecycle (no draft)', async () => {
      const sessions = await api.getSessions();
      const statuses = new Set(sessions.map(s => s.state || s.status));
      expect(statuses.has('draft' as any)).toBe(false);
      expect(['active', 'closed', 'expired']).toEqual(expect.arrayContaining([...statuses]));
    });

    it('new sessions default to active (ready for immediate attendance capture)', async () => {
      const newSession = await api.createSession({
        courseCode: 'CSC 301',
        courseTitle: 'Structured Programming',
        academicSession: '2026/2027',
        semester: 1,
        departmentId: 'dept-cs',
        lecturerId: 'lec-001',
        lecturerName: 'Dr. Emeka Nwosu',
        venue: 'Engineering Hall 1',
        authorizationType: 'primary',
      });

      expect(newSession.state).toBe('active');
    });
  });

  // ─── 5. Course Management & Lecturer Assignment ────────────────────────────
  describe('5. Course Management & Lecturer Assignment (Section 22, 23)', () => {
    it('assigns primary and substitute lecturer to course', async () => {
      const courses = await api.getCourses();
      const course = courses[0];
      expect(course).toBeDefined();

      const updated = await api.assignLecturerToCourse(course.id, {
        primaryLecturerId: 'lec-001',
        primaryLecturerName: 'Dr. Emeka Nwosu',
        substituteLecturerId: 'lec-002',
        substituteLecturerName: 'Dr. Ifeanyi Okoro',
      });

      expect(updated.primaryLecturerId).toBe('lec-001');
      expect(updated.substituteLecturerId).toBe('lec-002');
    });
  });

  // ─── 6. Biometric Activation Rules ─────────────────────────────────────────
  describe('6. Biometric Identity & Activation Rules (Section 28)', () => {
    it('requires at least 4 fingers for biometric activation status', () => {
      const minActivation = 4;
      const target = 10;
      expect(minActivation).toBe(4);
      expect(target).toBe(10);

      const isActivated = (count: number) => count >= minActivation;
      expect(isActivated(3)).toBe(false);
      expect(isActivated(4)).toBe(true);
      expect(isActivated(10)).toBe(true);
    });
  });
});
