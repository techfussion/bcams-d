/**
 * BCAMS Desktop - Backend HTTP REST Client Adapter
 * 
 * Production-ready HTTP client implementing the BcamsApi interface.
 * Connects to the Django / FastAPI / Express BCAMS backend service.
 * Handles JWT bearer authentication, request timeouts, error serialization,
 * and standard university REST endpoints.
 */
import type { BcamsApi } from './types';
import type {
  User, Department, Course, CourseOffering, Student, AcademicEnrollment, Lecturer, Staff,
  Session, AttendanceEvent, ClockEvent, DailyClockRecord, Device,
  Policy, AuditEntry, FingerEnrollment, SyncState,
} from '@/types';

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseData?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class HttpApiAdapter implements BcamsApi {
  private baseUrl: string;
  private token: string | null = null;
  private defaultTimeoutMs: number = 10000;

  constructor(baseUrl?: string) {
    const rawUrl = baseUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:8000/api/v1';
    this.baseUrl = rawUrl.replace(/\/$/, '');
    
    // Check localStorage for persisted token if in browser/electron
    if (typeof window !== 'undefined' && window.localStorage) {
      this.token = window.localStorage.getItem('bcams_auth_token');
    }
  }

  public setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setToken(token: string | null): void {
    this.token = token;
    if (typeof window !== 'undefined' && window.localStorage) {
      if (token) {
        window.localStorage.setItem('bcams_auth_token', token);
      } else {
        window.localStorage.removeItem('bcams_auth_token');
      }
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  /**
   * Core request dispatcher with authentication, timeouts, and error parsing
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Client-Platform': 'bcams-desktop',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-2xx responses
      if (!response.ok) {
        let errorData: any = null;
        try {
          errorData = await response.json();
        } catch {
          // Response body was not JSON
        }

        const message = errorData?.detail || errorData?.message || `HTTP ${response.status}: ${response.statusText}`;

        // Handle 401 Unauthorized
        if (response.status === 401) {
          this.setToken(null);
        }

        throw new ApiError(message, response.status, errorData);
      }

      // 204 No Content
      if (response.status === 204) {
        return {} as T;
      }

      return (await response.json()) as T;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof ApiError) {
        throw err;
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ApiError(`Request timeout after ${this.defaultTimeoutMs}ms: ${url}`, 408);
      }
      throw new ApiError(err instanceof Error ? err.message : 'Network request failed', 0);
    }
  }

  // ─── BcamsApi Implementation ───────────────────────────────────────────────

  // Auth
  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  // Dashboard
  async getDashboardStats(): Promise<Record<string, number>> {
    return this.request<Record<string, number>>('/dashboard/stats');
  }

  // Departments
  async getDepartments(): Promise<Department[]> {
    return this.request<Department[]>('/departments');
  }

  async getDepartment(id: string): Promise<Department> {
    return this.request<Department>(`/departments/${id}`);
  }

  async createDepartment(department: Partial<Department>): Promise<Department> {
    return this.request<Department>('/departments', {
      method: 'POST',
      body: JSON.stringify(department),
    });
  }

  // Courses
  async getCourses(departmentId?: string): Promise<Course[]> {
    const query = departmentId ? `?department_id=${encodeURIComponent(departmentId)}` : '';
    return this.request<Course[]>(`/courses${query}`);
  }

  async getCourseOfferings(departmentId?: string): Promise<CourseOffering[]> {
    const query = departmentId ? `?department_id=${encodeURIComponent(departmentId)}` : '';
    return this.request<CourseOffering[]>(`/course-offerings${query}`);
  }

  async getEligibleCoursesForStudent(studentId: string): Promise<CourseOffering[]> {
    return this.request<CourseOffering[]>(`/students/${encodeURIComponent(studentId)}/eligible-courses`);
  }

  async createCourse(course: Partial<Course>): Promise<Course> {
    return this.request<Course>('/courses', {
      method: 'POST',
      body: JSON.stringify(course),
    });
  }

  // People
  async getStudents(departmentId?: string): Promise<Student[]> {
    const query = departmentId ? `?department_id=${encodeURIComponent(departmentId)}` : '';
    return this.request<Student[]>(`/students${query}`);
  }

  async getStudent(id: string): Promise<Student> {
    return this.request<Student>(`/students/${id}`);
  }

  async createStudent(student: Partial<Student>): Promise<Student> {
    return this.request<Student>('/students', {
      method: 'POST',
      body: JSON.stringify(student),
    });
  }

  async updateStudent(id: string, updates: Partial<Student>): Promise<Student> {
    return this.request<Student>(`/students/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async bulkImportStudents(records: any[]): Promise<{ importedCount: number; updatedEnrollments: number; errors: any[] }> {
    return this.request<{ importedCount: number; updatedEnrollments: number; errors: any[] }>('/students/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ records }),
    });
  }

  // Academic Enrollments
  async getAcademicEnrollments(studentId?: string, departmentId?: string): Promise<AcademicEnrollment[]> {
    const params = new URLSearchParams();
    if (studentId) params.append('student_id', studentId);
    if (departmentId) params.append('department_id', departmentId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<AcademicEnrollment[]>(`/academic/enrollments${query}`);
  }

  async createAcademicEnrollment(enrollment: Partial<AcademicEnrollment>): Promise<AcademicEnrollment> {
    return this.request<AcademicEnrollment>('/academic/enrollments', {
      method: 'POST',
      body: JSON.stringify(enrollment),
    });
  }

  async getLecturers(departmentId?: string): Promise<Lecturer[]> {
    const query = departmentId ? `?department_id=${encodeURIComponent(departmentId)}` : '';
    return this.request<Lecturer[]>(`/lecturers${query}`);
  }

  async getLecturer(id: string): Promise<Lecturer> {
    return this.request<Lecturer>(`/lecturers/${id}`);
  }

  async createLecturer(lecturer: Partial<Lecturer>): Promise<Lecturer> {
    return this.request<Lecturer>('/lecturers', {
      method: 'POST',
      body: JSON.stringify(lecturer),
    });
  }

  async linkStaffToLecturer(staffId: string, lecturerData: Partial<Lecturer>): Promise<Lecturer> {
    return this.request<Lecturer>(`/staff/${staffId}/link-lecturer`, {
      method: 'POST',
      body: JSON.stringify(lecturerData),
    });
  }

  async getStaff(departmentId?: string): Promise<Staff[]> {
    const query = departmentId ? `?department_id=${encodeURIComponent(departmentId)}` : '';
    return this.request<Staff[]>(`/staff${query}`);
  }

  async getStaffMember(id: string): Promise<Staff> {
    return this.request<Staff>(`/staff/${id}`);
  }

  async createStaff(staff: Partial<Staff>): Promise<Staff> {
    return this.request<Staff>('/staff', {
      method: 'POST',
      body: JSON.stringify(staff),
    });
  }

  // Sessions
  async getSessions(courseOfferingId?: string): Promise<Session[]> {
    const query = courseOfferingId ? `?offering_id=${encodeURIComponent(courseOfferingId)}` : '';
    return this.request<Session[]>(`/sessions${query}`);
  }

  async getSession(id: string): Promise<Session> {
    return this.request<Session>(`/sessions/${id}`);
  }

  async createSession(session: Partial<Session>): Promise<Session> {
    return this.request<Session>('/sessions', {
      method: 'POST',
      body: JSON.stringify(session),
    });
  }

  async authorizeSession(sessionId: string, lecturerId: string): Promise<Session> {
    return this.request<Session>(`/sessions/${sessionId}/authorize`, {
      method: 'POST',
      body: JSON.stringify({ lecturer_id: lecturerId }),
    });
  }

  async activateSession(sessionId: string): Promise<Session> {
    return this.request<Session>(`/sessions/${sessionId}/activate`, {
      method: 'POST',
    });
  }

  async closeSession(sessionId: string): Promise<Session> {
    return this.request<Session>(`/sessions/${sessionId}/close`, {
      method: 'POST',
    });
  }

  async closeSessionWithLecturer(sessionId: string, lecturerFingerprintId: string): Promise<{ success: boolean; session?: Session; error?: string }> {
    return this.request<{ success: boolean; session?: Session; error?: string }>(`/sessions/${sessionId}/close-authorized`, {
      method: 'POST',
      body: JSON.stringify({ lecturer_fingerprint_id: lecturerFingerprintId }),
    });
  }

  // Attendance
  async getAttendanceEvents(sessionId: string): Promise<AttendanceEvent[]> {
    return this.request<AttendanceEvent[]>(`/sessions/${sessionId}/attendance`);
  }

  async submitAttendanceCapture(event: Partial<AttendanceEvent>): Promise<AttendanceEvent> {
    return this.request<AttendanceEvent>('/attendance/capture', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async submitAttendanceBatch(events: AttendanceEvent[]): Promise<{ ingestedCount: number; duplicates: number }> {
    return this.request<{ ingestedCount: number; duplicates: number }>('/attendance/batch-sync', {
      method: 'POST',
      body: JSON.stringify({ events }),
    });
  }

  // Gate Clock Events
  async getClockEvents(departmentId?: string, date?: string): Promise<ClockEvent[]> {
    const params = new URLSearchParams();
    if (departmentId) params.append('department_id', departmentId);
    if (date) params.append('date', date);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request<ClockEvent[]>(`/gate/events${queryString}`);
  }

  async getDailyClockRecords(departmentId?: string, date?: string): Promise<DailyClockRecord[]> {
    const params = new URLSearchParams();
    if (departmentId) params.append('department_id', departmentId);
    if (date) params.append('date', date);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request<DailyClockRecord[]>(`/gate/daily-records${queryString}`);
  }

  async getGateRecords(filters?: { startDate?: string; endDate?: string; departmentId?: string; punctuality?: string }): Promise<DailyClockRecord[]> {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('start_date', filters.startDate);
    if (filters?.endDate) params.append('end_date', filters.endDate);
    if (filters?.departmentId) params.append('department_id', filters.departmentId);
    if (filters?.punctuality) params.append('punctuality', filters.punctuality);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.request<DailyClockRecord[]>(`/gate/records${queryString}`);
  }

  async recordClockEvent(event: Partial<ClockEvent>): Promise<ClockEvent> {
    return this.request<ClockEvent>('/gate/clock', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  // Devices
  async getDevices(): Promise<Device[]> {
    return this.request<Device[]>('/devices');
  }

  async getDevice(id: string): Promise<Device> {
    return this.request<Device>(`/devices/${id}`);
  }

  async registerDevice(device: Partial<Device>): Promise<Device> {
    return this.request<Device>('/devices', {
      method: 'POST',
      body: JSON.stringify(device),
    });
  }

  async updateDeviceLifecycle(id: string, state: string, notes?: string): Promise<Device> {
    return this.request<Device>(`/devices/${id}/lifecycle`, {
      method: 'PATCH',
      body: JSON.stringify({ state, notes }),
    });
  }

  async updateDeviceStatus(id: string, status: string, notes?: string): Promise<Device> {
    return this.request<Device>(`/devices/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    });
  }

  // Policies
  async getPolicies(): Promise<Policy[]> {
    return this.request<Policy[]>('/policies');
  }

  async createPolicy(policy: Partial<Policy>): Promise<Policy> {
    return this.request<Policy>('/policies', {
      method: 'POST',
      body: JSON.stringify(policy),
    });
  }

  // Audit
  async getAuditEntries(limit?: number): Promise<AuditEntry[]> {
    const query = limit ? `?limit=${limit}` : '';
    return this.request<AuditEntry[]>(`/audit${query}`);
  }

  // Biometrics
  async getFingerEnrollments(personId: string): Promise<FingerEnrollment[]> {
    return this.request<FingerEnrollment[]>(`/people/${personId}/biometrics`);
  }

  async saveFingerEnrollment(personId: string, enrollment: Partial<FingerEnrollment>): Promise<FingerEnrollment> {
    return this.request<FingerEnrollment>(`/people/${personId}/biometrics`, {
      method: 'POST',
      body: JSON.stringify(enrollment),
    });
  }

  // Sync
  async getSyncState(): Promise<SyncState> {
    return this.request<SyncState>('/sync/status');
  }
}

export const httpApi = new HttpApiAdapter();
