/**
 * Students Page
 * 
 * FR-8.1: Student records management, course enrollments,
 * and biometric status tracking.
 */
import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { BiometricStatusBadge } from '@/components/common/status-indicators';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import type { Student, Department } from '@/types';
import { Plus, GraduationCap, UserCheck } from 'lucide-react';

const statusVariants: Record<string, 'success' | 'warning' | 'muted' | 'destructive'> = {
  active: 'success',
  inactive: 'muted',
  withdrawn: 'destructive',
  graduated: 'default' as any,
};

export function StudentsPage() {
  const { user } = useAuthStore();
  const [students, setStudents] = useState<Student[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [programme, setProgramme] = useState('B.Sc. Computer Science');
  const [level, setLevel] = useState(200);

  useEffect(() => {
    async function loadData() {
      try {
        const [studs, depts] = await Promise.all([
          api.getStudents(user?.role === 'hod' ? user.departmentId : undefined),
          api.getDepartments(),
        ]);
        setStudents(studs);
        setDepartments(depts);
        if (depts.length > 0) setSelectedDeptId(depts[0].id);
      } catch (err) {
        console.error('Failed to load students:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleRegisterStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const dept = departments.find(d => d.id === selectedDeptId) || departments[0];
    const newStudent: Student = {
      id: `stu-${Date.now().toString().slice(-4)}`,
      fullName,
      matricNumber,
      departmentId: dept.id,
      departmentName: dept.name,
      programme,
      level,
      status: 'active',
      specializations: ['student'],
      biometricStatus: 'not_enrolled',
      enrolledFingers: 0,
      academicSession: '2026/2027',
      courseEnrollments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setStudents([newStudent, ...students]);
    setIsRegisterModalOpen(false);
    setFullName('');
    setMatricNumber('');
  };

  const columns: DataTableColumn<Student>[] = [
    {
      key: 'name',
      header: 'Student',
      sortable: true,
      sortFn: (a, b) => a.fullName.localeCompare(b.fullName),
      render: (s) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-semibold text-primary-700">
            {s.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="font-semibold text-foreground text-xs">{s.fullName}</p>
            <p className="text-xs text-muted-foreground font-mono">{s.matricNumber}</p>
          </div>
        </div>
      ),
    },
    { key: 'programme', header: 'Programme', render: (s) => <span className="text-xs text-foreground">{s.programme}</span> },
    { key: 'level', header: 'Level', render: (s) => <span className="text-xs font-mono text-muted-foreground">{s.level}L</span> },
    { key: 'department', header: 'Department', render: (s) => <span className="text-xs text-foreground">{s.departmentName}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (s) => <Badge variant={statusVariants[s.status] || 'muted'}>{s.status.charAt(0).toUpperCase() + s.status.slice(1)}</Badge>,
    },
    {
      key: 'biometric',
      header: 'Biometric Status',
      render: (s) => (
        <div className="flex items-center gap-2">
          <BiometricStatusBadge status={s.biometricStatus} />
          <span className="text-xs font-mono text-muted-foreground">({s.enrolledFingers}/10)</span>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Student Registry"
        subtitle="Manage student academic records, programme enrollments, and biometric profile readiness"
        actions={
          <Button
            size="sm"
            onClick={() => setIsRegisterModalOpen(true)}
            className="gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Register Student
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-section animate-fadeIn">
          <DataTable
            columns={columns}
            data={students}
            isLoading={isLoading}
            searchPlaceholder="Search students by name or matric number..."
            searchFn={(s, q) => s.fullName.toLowerCase().includes(q) || s.matricNumber.toLowerCase().includes(q)}
            getRowId={(s) => s.id}
            emptyTitle="No students found"
            emptyDescription="No student records exist for this scope."
            emptyAction={{ label: 'Register Student', onClick: () => setIsRegisterModalOpen(true) }}
          />
        </div>
      </div>

      {/* Register Student Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-md w-full p-6 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-foreground text-base">
                  Register Student (FR-8.1)
                </h3>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterStudent} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Daniel Chukwuma"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Matriculation Number
                </label>
                <input
                  type="text"
                  value={matricNumber}
                  onChange={(e) => setMatricNumber(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  placeholder="e.g. CS/2024/042"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Level
                  </label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(Number(e.target.value))}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={100}>100 Level</option>
                    <option value={200}>200 Level</option>
                    <option value={300}>300 Level</option>
                    <option value={400}>400 Level</option>
                    <option value={500}>500 Level</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Programme of Study
                </label>
                <input
                  type="text"
                  value={programme}
                  onChange={(e) => setProgramme(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. B.Sc. Computer Science"
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
                  Register Student
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
