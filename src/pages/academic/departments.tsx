/**
 * Departments Page
 * 
 * Addendum 5: Departmental scoping — HOD only views own department,
 * Super Administrator manages all academic departments institution-wide.
 */
import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatCardSkeleton } from '@/components/common/empty-error-states';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import type { Department } from '@/types';
import { Building2, Users, GraduationCap, BookOpen, Plus } from 'lucide-react';

export function DepartmentsPage() {
  const { user } = useAuthStore();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form state
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [faculty, setFaculty] = useState('Faculty of Science');
  const [hodName, setHodName] = useState('');

  useEffect(() => {
    api.getDepartments().then(data => {
      // Addendum 5: HOD only sees own department
      if (user?.role === 'hod' && user.departmentId) {
        setDepartments(data.filter(d => d.id === user.departmentId));
      } else {
        setDepartments(data);
      }
      setIsLoading(false);
    });
  }, [user]);

  const handleAddDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    const newDept: Department = {
      id: `dept-${Date.now().toString().slice(-4)}`,
      name: deptName,
      code: deptCode.toUpperCase(),
      faculty,
      hodName: hodName || undefined,
      studentCount: 0,
      lecturerCount: 0,
      staffCount: 0,
      courseCount: 0,
    };

    setDepartments([...departments, newDept]);
    setIsAddModalOpen(false);
    setDeptName('');
    setDeptCode('');
    setHodName('');
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Academic Departments"
        subtitle="Addendum 5: Scoped faculty administration and departmental leadership"
        actions={
          user?.role === 'super_admin' ? (
            <Button
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="gap-1.5 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Add Department
            </Button>
          ) : undefined
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-section animate-fadeIn">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {departments.map(dept => (
                <Card key={dept.id} className="hover:shadow-card-hover transition-shadow border-primary/20">
                  <CardContent className="pt-card-padding">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="rounded-lg bg-primary-50 p-2 text-primary-700">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-bold text-foreground text-sm">{dept.name}</h3>
                            <p className="text-xs text-muted-foreground font-mono">{dept.code} • {dept.faculty}</p>
                          </div>
                        </div>
                        {dept.hodName && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Head of Department: <span className="font-semibold text-foreground">{dept.hodName}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 pt-3 border-t border-border">
                      <div className="text-center">
                        <GraduationCap className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                        <p className="text-sm font-bold text-foreground">{dept.studentCount}</p>
                        <p className="text-[10px] text-muted-foreground">Students</p>
                      </div>
                      <div className="text-center">
                        <Users className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                        <p className="text-sm font-bold text-foreground">{dept.lecturerCount}</p>
                        <p className="text-[10px] text-muted-foreground">Lecturers</p>
                      </div>
                      <div className="text-center">
                        <Users className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                        <p className="text-sm font-bold text-foreground">{dept.staffCount}</p>
                        <p className="text-[10px] text-muted-foreground">Staff</p>
                      </div>
                      <div className="text-center">
                        <BookOpen className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                        <p className="text-sm font-bold text-foreground">{dept.courseCount}</p>
                        <p className="text-[10px] text-muted-foreground">Courses</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Department Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-md w-full p-6 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-foreground text-base">
                  Add Academic Department
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddDepartment} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Mechanical Engineering"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Department Code
                  </label>
                  <input
                    type="text"
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value)}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono uppercase"
                    placeholder="e.g. MECH"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Faculty
                  </label>
                  <input
                    type="text"
                    value={faculty}
                    onChange={(e) => setFaculty(e.target.value)}
                    className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Appointed HOD Name
                </label>
                <input
                  type="text"
                  value={hodName}
                  onChange={(e) => setHodName(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Prof. Bamidele Ajayi"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Department
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
