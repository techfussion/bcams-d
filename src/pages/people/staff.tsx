/**
 * Staff Page — for gate attendance and non-academic staff records
 * 
 * FR-12.1: Staff registration (teaching and non-teaching)
 * FR-12.2: Biometric reuse from lecturer profiles.
 */
import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { BiometricStatusBadge } from '@/components/common/status-indicators';
import { PersonFormDialog } from '@/components/people';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks';
import type { Staff, Department } from '@/types';
import { Plus, Users, Shield, UserCheck } from 'lucide-react';

export function StaffPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [stfs, depts] = await Promise.all([
          api.getStaff(user?.role === 'hod' ? user.departmentId : undefined),
          api.getDepartments(),
        ]);
        setStaff(stfs);
        setDepartments(depts);
      } catch (err) {
        console.error('Failed to load staff:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleStaffCreated = (newStaff: Staff) => {
    setStaff([newStaff, ...staff]);
    toast({
      title: 'Staff Registered',
      description: `${newStaff.fullName} (${newStaff.staffId}) was registered successfully.`,
      variant: 'success',
    });
  };

  const columns: DataTableColumn<Staff>[] = [
    {
      key: 'name',
      header: 'Staff Personnel',
      sortable: true,
      sortFn: (a, b) => a.fullName.localeCompare(b.fullName),
      render: (s) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-50 text-primary flex items-center justify-center font-bold text-xs">
            {s.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="font-semibold text-foreground text-xs">{s.fullName}</p>
            <p className="text-xs text-muted-foreground font-mono">{s.staffId}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'designation',
      header: 'Designation / Post',
      sortable: true,
      sortFn: (a, b) => a.designation.localeCompare(b.designation),
      render: (s) => (
        <span className="text-xs font-medium text-foreground">{s.designation}</span>
      ),
    },
    {
      key: 'department',
      header: 'Department / Unit',
      sortable: true,
      sortFn: (a, b) => a.departmentName.localeCompare(b.departmentName),
      render: (s) => (
        <span className="text-xs text-muted-foreground">{s.departmentName}</span>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Email',
      render: (s) => (
        <span className="text-xs text-muted-foreground font-mono">
          {s.contactEmail || '—'}
        </span>
      ),
    },
    {
      key: 'biometric',
      header: 'Gate Biometric Status',
      render: (s) => (
        <div className="flex items-center gap-2">
          <BiometricStatusBadge status={s.biometricStatus} />
          <span className="text-xs font-mono text-muted-foreground font-semibold">
            {s.enrolledFingers}/10
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Staff Directory"
        subtitle="Manage administrative and non-academic personnel identities for gate attendance clocks."
        actions={
          <Button
            size="sm"
            onClick={() => setIsRegisterModalOpen(true)}
            className="gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Register Staff
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Quick Stats Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-white p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Staff
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">{staff.length}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Gate Authorized
              </p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {staff.filter((s) => s.biometricStatus === 'complete' || s.biometricStatus === 'activated').length}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Biometric Template Status
              </p>
              <p className="text-2xl font-bold text-primary mt-1">Active</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary flex items-center justify-center">
              <Shield className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={staff}
          isLoading={isLoading}
          searchPlaceholder="Search staff by name, staff ID, or designation..."
          emptyTitle="No staff members found"
          emptyDescription="No registered staff records found."
          selectable={true}
          selectedIds={selectedStaffIds}
          onSelectionChange={setSelectedStaffIds}
        />
      </div>

      {/* Registration Dialog */}
      <PersonFormDialog
        open={isRegisterModalOpen}
        onOpenChange={setIsRegisterModalOpen}
        personType="staff"
        departments={departments}
        onSubmitStaff={handleStaffCreated}
      />
    </div>
  );
}
