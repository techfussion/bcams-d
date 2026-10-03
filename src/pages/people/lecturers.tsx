/**
 * Lecturers Page
 * 
 * FR-8.2: Lecturer registry, course assignments,
 * and biometric enrollment tracking.
 */
import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { BiometricStatusBadge } from '@/components/common/status-indicators';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import type { Lecturer, Department, Course } from '@/types';
import { Plus, Users, BookOpen } from 'lucide-react';

export function LecturersPage() {
  const { user } = useAuthStore();
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [staffId, setStaffId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [lecs, depts, crs] = await Promise.all([
          api.getLecturers(user?.role === 'hod' ? user.departmentId : undefined),
          api.getDepartments(),
          api.getCourses(),
        ]);
        setLecturers(lecs);
        setDepartments(depts);
        setCourses(crs);
        if (depts.length > 0) setSelectedDeptId(depts[0].id);
      } catch (err) {
        console.error('Failed to load lecturers:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleRegisterLecturer = (e: React.FormEvent) => {
    e.preventDefault();
    const dept = departments.find(d => d.id === selectedDeptId) || departments[0];
    const newLecturer: Lecturer = {
      id: `lec-${Date.now().toString().slice(-4)}`,
      fullName,
      staffId,
      departmentId: dept.id,
      departmentName: dept.name,
      contactEmail,
      specializations: ['lecturer'],
      biometricStatus: 'not_enrolled',
      enrolledFingers: 0,
      assignedCourses: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setLecturers([newLecturer, ...lecturers]);
    setIsRegisterModalOpen(false);
    setFullName('');
    setStaffId('');
    setContactEmail('');
  };

  const columns: DataTableColumn<Lecturer>[] = [
    {
      key: 'name',
      header: 'Lecturer',
      sortable: true,
      sortFn: (a, b) => a.fullName.localeCompare(b.fullName),
      render: (l) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-semibold text-primary-700">
            {l.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="font-semibold text-foreground text-xs">{l.fullName}</p>
            <p className="text-xs text-muted-foreground font-mono">{l.staffId}</p>
          </div>
        </div>
      ),
    },
    { key: 'department', header: 'Department', render: (l) => <span className="text-xs text-foreground">{l.departmentName}</span> },
    {
      key: 'courses',
      header: 'Assigned Courses',
      render: (l) => (
        <div className="flex flex-wrap gap-1">
          {l.assignedCourses.filter(c => c.isActive).map(c => (
            <Badge key={c.id} variant="outline" className="text-[10px] bg-muted/40 font-mono">
              {c.courseCode}
            </Badge>
          ))}
          {l.assignedCourses.length === 0 && (
            <span className="text-xs text-muted-foreground italic">None assigned</span>
          )}
        </div>
      ),
    },
    { key: 'contact', header: 'Contact Email', render: (l) => <span className="text-xs text-muted-foreground font-mono">{l.contactEmail || '—'}</span> },
    { key: 'biometric', header: 'Biometric Status', render: (l) => <BiometricStatusBadge status={l.biometricStatus} /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Lecturer Registry"
        subtitle="FR-8.2: Faculty registry, course assignments, and substitute teaching authorities"
        actions={
          <Button
            size="sm"
            onClick={() => setIsRegisterModalOpen(true)}
            className="gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Register Lecturer
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-section animate-fadeIn">
          <DataTable
            columns={columns}
            data={lecturers}
            isLoading={isLoading}
            searchPlaceholder="Search lecturers by name or staff ID..."
            searchFn={(l, q) => l.fullName.toLowerCase().includes(q) || l.staffId.toLowerCase().includes(q)}
            getRowId={(l) => l.id}
            emptyTitle="No lecturers found"
            emptyDescription="No lecturer records have been created yet."
            emptyAction={{ label: 'Register Lecturer', onClick: () => setIsRegisterModalOpen(true) }}
          />
        </div>
      </div>

      {/* Register Lecturer Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-md w-full p-6 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-foreground text-base">
                  Register Lecturer (FR-8.2)
                </h3>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterLecturer} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Full Name & Title
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Dr. Kemi Balogun"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Staff ID
                  </label>
                  <input
                    type="text"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                    placeholder="e.g. LEC/CS/005"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Department
                  </label>
                  <select
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Institutional Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="k.balogun@institution.edu.ng"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRegisterModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Register Lecturer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
