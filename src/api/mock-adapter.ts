/**
 * Mock API Adapter
 * 
 * Implements BcamsApi using mock data.
 * Simulates async behavior with small delays for realistic UX testing.
 */
import type { BcamsApi } from './types';
import type { FingerEnrollment } from '@/types';
import {
  mockUsers, mockDepartments, mockCourses, mockCourseOfferings,
  mockStudents, mockLecturers, mockStaff, mockSessions,
  mockAttendanceEvents, mockClockEvents, mockDailyClockRecords,
  mockDevices, mockPolicies, mockAuditEntries, mockSyncState,
  mockDashboardStats, mockFingerEnrollments,
} from '@/mocks/data';
import { FINGER_POSITIONS } from '@/types';

const delay = (ms: number = 300) => new Promise(resolve => setTimeout(resolve, ms));

let currentUserId = 'user-sa';

export function setMockUser(userId: string) {
  currentUserId = userId;
}

export const mockApi: BcamsApi = {
  async getCurrentUser() {
    await delay(100);
    return mockUsers[currentUserId];
  },

  async getDashboardStats() {
    await delay(200);
    return mockDashboardStats;
  },

  async getDepartments() {
    await delay();
    return mockDepartments;
  },

  async getDepartment(id: string) {
    await delay();
    const dept = mockDepartments.find(d => d.id === id);
    if (!dept) throw new Error(`Department ${id} not found`);
    return dept;
  },

  async getCourses(departmentId?: string) {
    await delay();
    if (departmentId) {
      return mockCourses.filter(c => c.departmentId === departmentId);
    }
    return mockCourses;
  },

  async getCourseOfferings(departmentId?: string) {
    await delay();
    if (departmentId) {
      return mockCourseOfferings.filter(co => co.departmentId === departmentId);
    }
    return mockCourseOfferings;
  },

  async getStudents(departmentId?: string) {
    await delay();
    if (departmentId) {
      return mockStudents.filter(s => s.departmentId === departmentId);
    }
    return mockStudents;
  },

  async getStudent(id: string) {
    await delay();
    const student = mockStudents.find(s => s.id === id);
    if (!student) throw new Error(`Student ${id} not found`);
    return student;
  },

  async getLecturers(departmentId?: string) {
    await delay();
    if (departmentId) {
      return mockLecturers.filter(l => l.departmentId === departmentId);
    }
    return mockLecturers;
  },

  async getLecturer(id: string) {
    await delay();
    const lecturer = mockLecturers.find(l => l.id === id);
    if (!lecturer) throw new Error(`Lecturer ${id} not found`);
    return lecturer;
  },

  async getStaff(departmentId?: string) {
    await delay();
    if (departmentId) {
      return mockStaff.filter(s => s.departmentId === departmentId);
    }
    return mockStaff;
  },

  async getStaffMember(id: string) {
    await delay();
    const staff = mockStaff.find(s => s.id === id);
    if (!staff) throw new Error(`Staff ${id} not found`);
    return staff;
  },

  async getSessions(courseOfferingId?: string) {
    await delay();
    if (courseOfferingId) {
      return mockSessions.filter(s => s.courseOfferingId === courseOfferingId);
    }
    return mockSessions;
  },

  async getSession(id: string) {
    await delay();
    const session = mockSessions.find(s => s.id === id);
    if (!session) throw new Error(`Session ${id} not found`);
    return session;
  },

  async getAttendanceEvents(sessionId: string) {
    await delay();
    return mockAttendanceEvents.filter(ae => ae.sessionId === sessionId);
  },

  async getClockEvents(departmentId?: string, _date?: string) {
    await delay();
    if (departmentId) {
      const dept = mockDepartments.find(d => d.id === departmentId);
      if (dept) {
        return mockClockEvents.filter(ce => ce.staffDepartment === dept.name);
      }
    }
    return mockClockEvents;
  },

  async getDailyClockRecords(departmentId?: string, _date?: string) {
    await delay();
    if (departmentId) {
      const dept = mockDepartments.find(d => d.id === departmentId);
      if (dept) {
        return mockDailyClockRecords.filter(r => r.staffDepartment === dept.name);
      }
    }
    return mockDailyClockRecords;
  },

  async getDevices() {
    await delay();
    return mockDevices;
  },

  async getDevice(id: string) {
    await delay();
    const device = mockDevices.find(d => d.id === id);
    if (!device) throw new Error(`Device ${id} not found`);
    return device;
  },

  async getPolicies() {
    await delay();
    return mockPolicies;
  },

  async getAuditEntries(limit: number = 50) {
    await delay();
    return mockAuditEntries.slice(0, limit);
  },

  async getFingerEnrollments(personId: string) {
    await delay();
    const enrollments = mockFingerEnrollments[personId];
    if (enrollments) return enrollments;
    // Return empty enrollment for all fingers
    return FINGER_POSITIONS.map(pos => ({
      position: pos,
      enrolled: false,
    } as FingerEnrollment));
  },

  async getSyncState() {
    await delay(100);
    return mockSyncState;
  },
};
