import { describe, it, expect } from 'vitest';
import {
  computeAttendanceRate,
  evaluateEligibility,
  classifyPunctuality,
  summarizeSessionAttendance,
  generateCSV,
} from '@/domain';
import type { Policy, Session, AttendanceEvent } from '@/types';

describe('Domain Logic — Attendance & Exam Eligibility Rules', () => {
  describe('computeAttendanceRate', () => {
    it('calculates correct percentages and classifications', () => {
      const res1 = computeAttendanceRate(10, 10);
      expect(res1.percentage).toBe(100);
      expect(res1.status).toBe('excellent');

      const res2 = computeAttendanceRate(8, 10);
      expect(res2.percentage).toBe(80);
      expect(res2.status).toBe('good');

      const res3 = computeAttendanceRate(6, 10);
      expect(res3.percentage).toBe(60);
      expect(res3.status).toBe('warning');

      const res4 = computeAttendanceRate(4, 10);
      expect(res4.percentage).toBe(40);
      expect(res4.status).toBe('critical');

      // Edge case: 0 total sessions
      const resZero = computeAttendanceRate(0, 0);
      expect(resZero.percentage).toBe(0);
    });
  });

  describe('evaluateEligibility', () => {
    it('uses default threshold when no policies match', () => {
      const result = evaluateEligibility(8, 10, []);
      expect(result.eligible).toBe(true);
      expect(result.attendancePercentage).toBe(80);
      expect(result.requiredPercentage).toBe(75);
      expect(result.deficit).toBe(0);
    });

    it('identifies ineligible student and calculates session deficit', () => {
      const result = evaluateEligibility(5, 10, []);
      expect(result.eligible).toBe(false);
      expect(result.attendancePercentage).toBe(50);
      expect(result.requiredPercentage).toBe(75);
      expect(result.deficit).toBeGreaterThan(0);
    });

    it('hierarchically prefers course policy over departmental and institutional policies', () => {
      const policies: Policy[] = [
        {
          id: 'pol-inst',
          type: 'attendance_threshold',
          scope: 'institution',
          value: 70,
          effectiveFrom: '2026-01-01',
          createdBy: 'Admin',
          isActive: true,
        },
        {
          id: 'pol-dept',
          type: 'attendance_threshold',
          scope: 'department',
          scopeId: 'dept-cs',
          value: 75,
          effectiveFrom: '2026-01-01',
          createdBy: 'HOD',
          isActive: true,
        },
        {
          id: 'pol-course',
          type: 'attendance_threshold',
          scope: 'course',
          scopeId: 'crs-csc301',
          value: 85,
          effectiveFrom: '2026-01-01',
          createdBy: 'Lecturer',
          isActive: true,
        },
      ];

      // With 8 out of 10 (80%), eligible under inst (70%) and dept (75%), but ineligible under course (85%)
      const result = evaluateEligibility(8, 10, policies);
      expect(result.requiredPercentage).toBe(85);
      expect(result.eligible).toBe(false);
    });
  });

  describe('classifyPunctuality', () => {
    const policies: Policy[] = [
      {
        id: 'pol-punct',
        type: 'punctuality_hours',
        scope: 'institution',
        value: { expectedStart: '08:00', expectedEnd: '17:00', graceMinutes: 30 },
        effectiveFrom: '2026-01-01',
        createdBy: 'Admin',
        isActive: true,
      },
    ];

    it('marks punch within grace period as on-time', () => {
      const early = new Date('2026-10-04T08:15:00');
      const status = classifyPunctuality(early, policies);
      expect(status).toBe('on-time');
    });

    it('marks punch after grace period as late', () => {
      const late = new Date('2026-10-04T08:45:00');
      const status = classifyPunctuality(late, policies);
      expect(status).toBe('late');
    });
  });

  describe('summarizeSessionAttendance', () => {
    it('calculates session attendance summary and integrity breakdown', () => {
      const session: Session = {
        id: 'sess-001',
        courseOfferingId: 'off-001',
        courseCode: 'CSC 301',
        courseTitle: 'Database Systems',
        state: 'closed',
        lecturerId: 'lec-01',
        lecturerName: 'Dr. Adeyemi',
        geofenceRadius: 200,
        attendanceCount: 2,
        enrolledCount: 10,
        createdAt: new Date().toISOString(),
      };

      const events: AttendanceEvent[] = [
        {
          id: 'ev-1',
          sessionId: 'sess-001',
          deviceId: 'dev-desk-01',
          studentId: 'stu-1',
          studentName: 'Alice',
          matricNumber: 'CSC/21/001',
          timestamp: new Date().toISOString(),
          clockIntegrity: 'verified',
          syncStatus: 'synced',
        },
        {
          id: 'ev-2',
          sessionId: 'sess-001',
          deviceId: 'dev-desk-01',
          studentId: 'stu-2',
          studentName: 'Bob',
          matricNumber: 'CSC/21/002',
          timestamp: new Date().toISOString(),
          clockIntegrity: 'suspicious',
          syncStatus: 'pending',
        },
      ];

      const summary = summarizeSessionAttendance(session, events);
      expect(summary.totalPresent).toBe(2);
      expect(summary.totalEnrolled).toBe(10);
      expect(summary.attendanceRate).toBe(20);
      expect(summary.verifiedEvents).toBe(1);
      expect(summary.suspiciousEvents).toBe(1);
    });
  });

  describe('generateCSV', () => {
    it('escapes commas and quotes in CSV output', () => {
      const data = [
        { name: 'John Doe', matric: 'CSC/2021/001', note: 'Normal' },
        { name: 'Smith, Jane', matric: 'CSC/2021/002', note: 'Has "Quotes"' },
      ];

      const csv = generateCSV(data, [
        { header: 'Student Name', accessor: (d) => d.name },
        { header: 'Matric', accessor: (d) => d.matric },
        { header: 'Remarks', accessor: (d) => d.note },
      ]);

      expect(csv).toContain('Student Name,Matric,Remarks');
      expect(csv).toContain('"Smith, Jane"');
      expect(csv).toContain('""Quotes""');
    });
  });
});
