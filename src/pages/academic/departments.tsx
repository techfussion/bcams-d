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
import { DepartmentFormDialog } from '@/components/academic';
import { StatCardSkeleton } from '@/components/common/empty-error-states';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks';
import type { Department } from '@/types';
import { Building2, Users, GraduationCap, BookOpen, Plus } from 'lucide-react';

export function DepartmentsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    api.getDepartments().then((data) => {
      if (user?.role === 'hod' && user.departmentId) {
        setDepartments(data.filter((d) => d.id === user.departmentId));
      } else {
        setDepartments(data);
      }
      setIsLoading(false);
    });
  }, [user]);

  const handleDepartmentCreated = (newDept: Department) => {
    setDepartments([...departments, newDept]);
    toast({
      title: 'Department Created',
      description: `${newDept.name} (${newDept.code}) has been established.`,
      variant: 'success',
    });
  };

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Academic Departments"
        subtitle="Scoped faculty administration, academic leadership, and departmental statistics."
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

      <div className="flex-1 p-6 space-y-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {departments.map((dept) => (
              <Card key={dept.id} className="border border-border shadow-xs hover:border-primary/40 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary flex items-center justify-center font-bold text-sm">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                          {dept.name}
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-normal">
                            {dept.code}
                          </span>
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{dept.faculty}</p>
                      </div>
                    </div>
                  </div>

                  {dept.hodName && (
                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Head of Department:</span>
                      <span className="font-medium text-foreground">{dept.hodName}</span>
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center pt-3 border-t border-border">
                    <div className="rounded-md bg-muted/40 p-2">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] mb-0.5">
                        <GraduationCap className="h-3 w-3" />
                        <span>Students</span>
                      </div>
                      <p className="font-bold text-foreground text-sm">{dept.studentCount}</p>
                    </div>

                    <div className="rounded-md bg-muted/40 p-2">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] mb-0.5">
                        <Users className="h-3 w-3" />
                        <span>Lecturers</span>
                      </div>
                      <p className="font-bold text-foreground text-sm">{dept.lecturerCount}</p>
                    </div>

                    <div className="rounded-md bg-muted/40 p-2">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground text-[10px] mb-0.5">
                        <BookOpen className="h-3 w-3" />
                        <span>Courses</span>
                      </div>
                      <p className="font-bold text-foreground text-sm">{dept.courseCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <DepartmentFormDialog
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSubmit={handleDepartmentCreated}
      />
    </div>
  );
}
