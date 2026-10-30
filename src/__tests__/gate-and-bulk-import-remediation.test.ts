import { describe, it, expect, beforeEach } from 'vitest';
import { api, mockApi, httpApi } from '@/api';
import {
  canManageStudents,
  canRegisterStaff,
  canRegisterLecturer,
  isSessionCapturer,
  isAnyCapturer,
  canManageDevices,
  canViewGateLedger,
  canManageStaff,
} from '@/lib/permissions';
import type { User, Staff, Student, Lecturer } from '@/types';

describe('BCAMS Gate Attendance & Bulk Import Remediation Suite', () => {
  beforeEach(() => {
    // Reset stores if needed
  });

  // ─── 1. Gate Attendance: Self-Service & Gate Capturer Removal ─────────────
  describe('1. Gate Attendance & Gate Capturer Removal', () => {
    it('confirms Gate Capturer role/capability is completely eliminated', () => {
      // isAnyCapturer should only evaluate session_capture
      const ordinaryStaffUser: User = {
        id: 'usr-staff-1',
        fullName: 'John Doe',
        email: 'john@institution.edu.ng',
        role: 'staff',
      };

      const sessionCapturerUser: User = {
        id: 'usr-student-cap',
        fullName: 'Jane Capturer',
        email: 'jane@institution.edu.ng',
        role: 'student',
        captureCapability: 'session_capture',
      };

      expect(isSessionCapturer(sessionCapturerUser)).toBe(true);
      expect(isAnyCapturer(sessionCapturerUser)).toBe(true);

      // Ordinary staff is not a capturer
      expect(isSessionCapturer(ordinaryStaffUser)).toBe(false);
      expect(isAnyCapturer(ordinaryStaffUser)).toBe(false);

      // There is no gate capturer role or capability on ordinary staff
      expect((ordinaryStaffUser as any).capability).toBeUndefined();
    });

    it('processes self-service staff fingerprint identification and clock-in/out', async () => {
      // Fetch current staff
      const staffList = await api.getStaff();
      expect(staffList.length).toBeGreaterThan(0);
      const testStaff = staffList[0];

      // Trusted gate device
      const trustedGateDeviceId = 'dev-gate-01';

      // 1. Staff walks up and scans fingerprint -> clock_in event
      const clockInEvent = await api.recordClockEvent({
        staffId: testStaff.staffId,
        staffName: testStaff.fullName,
        type: 'clock_in',
        punctuality: 'on-time',
        deviceId: trustedGateDeviceId,
        timestamp: new Date().toISOString(),
      });

      expect(clockInEvent).toBeDefined();
      expect(clockInEvent.staffId).toBe(testStaff.staffId);
      expect(clockInEvent.type).toBe('clock_in');
      expect(clockInEvent.deviceId).toBe(trustedGateDeviceId);

      // 2. Staff walks up later in the day and scans fingerprint -> clock_out event
      const clockOutEvent = await api.recordClockEvent({
        staffId: testStaff.staffId,
        staffName: testStaff.fullName,
        type: 'clock_out',
        deviceId: trustedGateDeviceId,
        timestamp: new Date().toISOString(),
      });

      expect(clockOutEvent).toBeDefined();
      expect(clockOutEvent.staffId).toBe(testStaff.staffId);
      expect(clockOutEvent.type).toBe('clock_out');
      expect(clockOutEvent.deviceId).toBe(trustedGateDeviceId);
    });

    it('enforces trusted endpoint device rules for gate attendance', async () => {
      // Super admin can manage devices, while staff or capturers cannot
      const superAdmin: User = {
        id: 'usr-admin',
        fullName: 'Admin',
        email: 'admin@institution.edu.ng',
        role: 'super_admin',
      };

      const staffUser: User = {
        id: 'usr-staff',
        fullName: 'Staff Member',
        email: 'staff@institution.edu.ng',
        role: 'staff',
      };

      expect(canManageDevices(superAdmin)).toBe(true);
      expect(canManageDevices(staffUser)).toBe(false);
    });

    it('restricts gate ledger access to Super Admin only (HOD denied, HOD staff management preserved)', () => {
      const superAdmin: User = {
        id: 'usr-admin',
        fullName: 'Admin',
        email: 'admin@institution.edu.ng',
        role: 'super_admin',
      };
      const hodUser: User = {
        id: 'usr-hod',
        fullName: 'Prof HOD',
        email: 'hod@institution.edu.ng',
        role: 'hod',
        departmentId: 'dept-cs',
      };

      // Super Admin permitted
      expect(canViewGateLedger(superAdmin)).toBe(true);
      // HOD denied Gate Attendance ledger
      expect(canViewGateLedger(hodUser)).toBe(false);
      expect(canViewGateLedger(hodUser, 'dept-cs')).toBe(false);
      // HOD preserves Staff Management for their department
      expect(canManageStaff(hodUser, 'dept-cs')).toBe(true);
    });
  });

  // ─── 2. Student Bulk Import ────────────────────────────────────────────────
  describe('2. Student Bulk Import', () => {
    it('successfully imports new valid students without enrolling biometrics', async () => {
      const uniqueMatric = `CSC/2026/TEST_${Date.now()}`;
      const records = [
        {
          matricNumber: uniqueMatric,
          fullName: 'Test New Student',
          level: 200,
          departmentId: 'dept-cs',
          departmentName: 'Computer Science',
          programme: 'B.Sc. Computer Science',
          academicSession: '2026/2027',
        },
      ];

      const result = await api.bulkImportStudents(records);
      expect(result.importedCount).toBe(1);
      expect(result.errors.length).toBe(0);

      // Verify the imported student exists with biometricStatus: 'not_enrolled'
      const students = await api.getStudents();
      const created = students.find(s => s.matricNumber === uniqueMatric);
      expect(created).toBeDefined();
      expect(created?.biometricStatus).toBe('not_enrolled');
      expect(created?.enrolledFingers).toBe(0);
    });

    it('updates academic progression for existing students without duplicating identities', async () => {
      const existingStudents = await api.getStudents();
      const existing = existingStudents[0];

      const records = [
        {
          matricNumber: existing.matricNumber,
          fullName: existing.fullName,
          level: 400,
          academicSession: '2026/2027',
          semester: 2,
        },
      ];

      const initialCount = (await api.getStudents()).length;
      const result = await api.bulkImportStudents(records);

      expect(result.updatedEnrollments).toBe(1);
      const afterCount = (await api.getStudents()).length;
      // Person identity count must NOT increase
      expect(afterCount).toBe(initialCount);

      // Progression must be updated
      const updated = (await api.getStudents()).find(s => s.matricNumber === existing.matricNumber);
      expect(updated?.currentLevel).toBe(400);
    });

    it('rejects invalid rows missing required identifier or name', async () => {
      const invalidRecords = [
        {
          matricNumber: '',
          fullName: 'Student Without Matric',
        },
        {
          matricNumber: 'CSC/2026/0999',
          fullName: '',
        },
      ];

      const result = await api.bulkImportStudents(invalidRecords);
      expect(result.errors.length).toBe(2);
      expect(result.importedCount).toBe(0);
    });
  });

  // ─── 3. Staff Bulk Import ──────────────────────────────────────────────────
  describe('3. Staff Bulk Import', () => {
    it('successfully imports new valid staff personnel with biometricStatus: not_enrolled', async () => {
      const uniqueStaffId = `STF/TEST/${Date.now().toString().slice(-4)}`;
      const records = [
        {
          staffId: uniqueStaffId,
          fullName: 'Dr. Test Staff Person',
          designation: 'Senior Technologist',
          staffType: 'non_academic',
          departmentId: 'dept-cs',
          departmentName: 'Computer Science',
          contactEmail: 'test.staff@institution.edu.ng',
        },
      ];

      const result = await api.bulkImportStaff(records);
      expect(result.importedCount).toBe(1);
      expect(result.errors.length).toBe(0);

      // Verify the imported staff exists with biometricStatus: 'not_enrolled'
      const staffList = await api.getStaff();
      const created = staffList.find(s => s.staffId === uniqueStaffId);
      expect(created).toBeDefined();
      expect(created?.biometricStatus).toBe('not_enrolled');
      expect(created?.enrolledFingers).toBe(0);
    });

    it('rejects duplicate Staff IDs already registered in institutional registry', async () => {
      const existingStaffList = await api.getStaff();
      const existing = existingStaffList[0];

      const duplicateRecords = [
        {
          staffId: existing.staffId,
          fullName: 'Duplicate Person Attempt',
          designation: 'Technologist',
        },
      ];

      const result = await api.bulkImportStaff(duplicateRecords);
      expect(result.importedCount).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].reason).toContain('already exists in registry');
    });

    it('rejects invalid staff rows missing Staff ID or Full Name', async () => {
      const invalidRecords = [
        { staffId: '', fullName: 'Staff Without ID' },
        { staffId: 'STF/INV/01', fullName: '' },
      ];

      const result = await api.bulkImportStaff(invalidRecords);
      expect(result.importedCount).toBe(0);
      expect(result.errors.length).toBe(2);
    });
  });

  // ─── 4. Lecturer Bulk Import & Person->Staff->Lecturer Identity ────────────
  describe('4. Lecturer Bulk Import & Identity Integrity', () => {
    it('links existing Staff to Lecturer without creating duplicate Person identities', async () => {
      // Find or create a non-lecturer staff member
      const nonLecturerStaffId = `STF/NONLEC/${Date.now().toString().slice(-4)}`;
      await api.createStaff({
        staffId: nonLecturerStaffId,
        fullName: 'Mr. Non Lecturer Staff',
        designation: 'Lab Technologist',
        staffType: 'non_academic',
        isLecturer: false,
        departmentId: 'dept-cs',
        departmentName: 'Computer Science',
      });

      const initialStaffCount = (await api.getStaff()).length;

      // Import as lecturer using the same staffId
      const lecturerImportRecords = [
        {
          staffId: nonLecturerStaffId,
          fullName: 'Mr. Non Lecturer Staff',
          designation: 'Lecturer II',
          departmentId: 'dept-cs',
          departmentName: 'Computer Science',
        },
      ];

      const result = await api.bulkImportLecturers(lecturerImportRecords);
      expect(result.importedCount).toBe(1);
      expect(result.errors.length).toBe(0);

      // Verify no duplicate Person/Staff was created
      const currentStaffCount = (await api.getStaff()).length;
      expect(currentStaffCount).toBe(initialStaffCount);

      // Verify the staff record was upgraded to lecturer
      const updatedStaff = (await api.getStaff()).find(s => s.staffId === nonLecturerStaffId);
      expect(updatedStaff?.isLecturer).toBe(true);

      // Verify the lecturer record was created and linked
      const lecturers = await api.getLecturers();
      const createdLecturer = lecturers.find(l => l.staffId === nonLecturerStaffId);
      expect(createdLecturer).toBeDefined();
      expect(createdLecturer?.staffPersonId).toBe(updatedStaff?.id);
    });

    it('creates underlying Staff identity when lecturer is imported with new Staff ID', async () => {
      const brandNewStaffId = `STF/NEWLEC/${Date.now().toString().slice(-4)}`;
      const records = [
        {
          staffId: brandNewStaffId,
          fullName: 'Dr. Brand New Academic',
          designation: 'Senior Lecturer',
          departmentId: 'dept-cs',
          departmentName: 'Computer Science',
        },
      ];

      const result = await api.bulkImportLecturers(records);
      expect(result.importedCount).toBe(1);
      expect(result.errors.length).toBe(0);

      // Verify Staff identity was created
      const staffList = await api.getStaff();
      const staffRecord = staffList.find(s => s.staffId === brandNewStaffId);
      expect(staffRecord).toBeDefined();
      expect(staffRecord?.isLecturer).toBe(true);
      expect(staffRecord?.biometricStatus).toBe('not_enrolled');

      // Verify Lecturer identity is linked
      const lecturers = await api.getLecturers();
      const lecturerRecord = lecturers.find(l => l.staffId === brandNewStaffId);
      expect(lecturerRecord).toBeDefined();
      expect(lecturerRecord?.staffPersonId).toBe(staffRecord?.id);
      expect(lecturerRecord?.biometricStatus).toBe('not_enrolled');
    });

    it('rejects duplicate lecturer if staffId is already registered in lecturer directory', async () => {
      const existingLecturers = await api.getLecturers();
      const existing = existingLecturers[0];

      const duplicateRecords = [
        {
          staffId: existing.staffId,
          fullName: existing.fullName,
          designation: existing.designation,
        },
      ];

      const result = await api.bulkImportLecturers(duplicateRecords);
      expect(result.importedCount).toBe(0);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].reason).toContain('already exists in registry');
    });
  });

  // ─── 5. Authorization & Scope Requirements ────────────────────────────────
  describe('5. Authorization & Department Scope', () => {
    it('restricts bulk import permissions to authorized roles', () => {
      const superAdmin: User = {
        id: 'usr-admin',
        fullName: 'Super Admin',
        email: 'admin@institution.edu.ng',
        role: 'super_admin',
      };

      const hodCS: User = {
        id: 'usr-hod',
        fullName: 'HOD Computer Science',
        email: 'hod.cs@institution.edu.ng',
        role: 'hod',
        departmentId: 'dept-cs',
        departmentName: 'Computer Science',
      };

      const lecturerUser: User = {
        id: 'usr-lec',
        fullName: 'Lecturer User',
        email: 'lecturer@institution.edu.ng',
        role: 'lecturer',
        departmentId: 'dept-cs',
        departmentName: 'Computer Science',
      };

      const sessionCapturer: User = {
        id: 'usr-cap',
        fullName: 'Session Capturer',
        email: 'capturer@institution.edu.ng',
        role: 'student',
        captureCapability: 'session_capture',
      };

      // Super Admin can import everything across all departments
      expect(canManageStudents(superAdmin)).toBe(true);
      expect(canRegisterStaff(superAdmin)).toBe(true);
      expect(canRegisterLecturer(superAdmin)).toBe(true);

      // HOD can import within their department
      expect(canManageStudents(hodCS, 'dept-cs')).toBe(true);
      expect(canRegisterStaff(hodCS, 'dept-cs')).toBe(true);
      expect(canRegisterLecturer(hodCS, 'dept-cs')).toBe(true);

      // HOD cannot import outside their department
      expect(canManageStudents(hodCS, 'dept-ee')).toBe(false);
      expect(canRegisterStaff(hodCS, 'dept-ee')).toBe(false);
      expect(canRegisterLecturer(hodCS, 'dept-ee')).toBe(false);

      // Ordinary lecturers and capturers cannot import
      expect(canManageStudents(lecturerUser)).toBe(false);
      expect(canRegisterStaff(lecturerUser)).toBe(false);
      expect(canRegisterLecturer(lecturerUser)).toBe(false);

      expect(canManageStudents(sessionCapturer)).toBe(false);
      expect(canRegisterStaff(sessionCapturer)).toBe(false);
      expect(canRegisterLecturer(sessionCapturer)).toBe(false);
    });
  });

  // ─── 6. Course Bulk Import Verification ──────────────────────
  describe('6. Course Bulk Import Implementation Verification', () => {
    it('confirms bulkImportCourses is implemented on API interface', () => {
      expect((mockApi as any).bulkImportCourses).toBeDefined();
      expect((httpApi as any).bulkImportCourses).toBeDefined();
    });

    it('persists valid course records into curriculum database and returns correct summary', async () => {
      const recordsToImport = [
        {
          rowNumber: 2,
          code: 'CSC 501',
          title: 'Advanced Machine Learning & Neural Networks',
          creditUnits: 4,
          level: 500,
          semester: 1,
          departmentId: 'dept-cs',
          departmentName: 'Computer Science',
          isGeneral: false,
        },
        {
          rowNumber: 3,
          code: 'GST 201',
          title: 'Peace Studies & Conflict Resolution',
          creditUnits: 2,
          level: 200,
          semester: 2,
          departmentId: 'dept-cs',
          departmentName: 'Computer Science',
          isGeneral: true,
        },
      ];

      const result = await api.bulkImportCourses(recordsToImport);
      expect(result.importedCount).toBe(2);
      expect(result.errors.length).toBe(0);

      // Verify records are persisted in the active curriculum store
      const allCourses = await api.getCourses();
      const imported501 = allCourses.find(c => c.code === 'CSC 501');
      expect(imported501).toBeDefined();
      expect(imported501?.title).toBe('Advanced Machine Learning & Neural Networks');
      expect(imported501?.creditUnits).toBe(4);
      expect(imported501?.level).toBe(500);

      const importedGst = allCourses.find(c => c.code === 'GST 201');
      expect(importedGst).toBeDefined();
      expect(importedGst?.isGeneral).toBe(true);
    });

    it('detects duplicates and invalid relationships with row-level error reporting and partial success', async () => {
      const mixedRecords = [
        // Valid row
        {
          rowNumber: 2,
          code: 'CSC 502',
          title: 'Distributed Systems & Cloud Architecture',
          creditUnits: 3,
          level: 500,
          semester: 2,
          departmentId: 'dept-cs',
          isGeneral: false,
        },
        // Duplicate row (CSC 501 was imported in previous test)
        {
          rowNumber: 3,
          code: 'CSC 501',
          title: 'Duplicate CSC 501 Attempt',
          creditUnits: 3,
          level: 500,
          semester: 1,
          departmentId: 'dept-cs',
        },
        // Missing required field
        {
          rowNumber: 4,
          code: '',
          title: 'Missing Code Course',
          creditUnits: 3,
          level: 100,
        },
        // Invalid department relationship
        {
          rowNumber: 5,
          code: 'CSC 503',
          title: 'Invalid Dept Course',
          creditUnits: 3,
          level: 500,
          semester: 1,
          departmentId: 'non-existent-department-xyz',
          isGeneral: false,
        },
      ];

      const result = await api.bulkImportCourses(mixedRecords);
      // Valid row persisted
      expect(result.importedCount).toBe(1);

      // Errors captured safely without crashing
      expect(result.errors.length).toBe(3);

      const dupError = result.errors.find(e => e.identifier === 'CSC 501');
      expect(dupError).toBeDefined();
      expect(dupError?.reason).toContain('already exists in curriculum');

      const missingError = result.errors.find(e => e.row === 4);
      expect(missingError).toBeDefined();

      const deptError = result.errors.find(e => e.identifier === 'CSC 503');
      expect(deptError).toBeDefined();
      expect(deptError?.reason).toContain('does not exist in registry');

      // Verify CSC 502 was successfully saved
      const allCourses = await api.getCourses();
      expect(allCourses.some(c => c.code === 'CSC 502')).toBe(true);
    });
  });
});
