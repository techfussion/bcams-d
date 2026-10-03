/**
 * Staff Page — for gate attendance staff records
 * 
 * FR-12.1: Staff registration (teaching and non-teaching)
 * FR-12.2: Biometric reuse from lecturer profiles.
 */
import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { BiometricStatusBadge } from '@/components/common/status-indicators';
import { Button } from '@/components/ui/button';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import type { Staff, Department } from '@/types';
import { Plus, Users, Shield } from 'lucide-react';

export function StaffPage() {
  const { user } = useAuthStore();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [staffId, setStaffId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [designation, setDesignation] = useState('Laboratory Technologist');

  useEffect(() => {
    async function loadData() {
      try {
        const [stfs, depts] = await Promise.all([
          api.getStaff(user?.role === 'hod' ? user.departmentId : undefined),
          api.getDepartments(),
        ]);
        setStaff(stfs);
        setDepartments(depts);
        if (depts.length > 0) setSelectedDeptId(depts[0].id);
      } catch (err) {
        console.error('Failed to load staff:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleRegisterStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const dept = departments.find(d => d.id === selectedDeptId) || departments[0];
    const newStaff: Staff = {
      id: `stf-${Date.now().toString().slice(-4)}`,
      fullName,
      staffId,
      departmentId: dept.id,
      departmentName: dept.name,
      designation,
      specializations: ['staff'],
      biometricStatus: 'not_enrolled',
      enrolledFingers: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setStaff([newStaff, ...staff]);
    setIsRegisterModalOpen(false);
    setFullName('');
    setStaffId('');
  };

  const columns: DataTableColumn<Staff>[] = [
    {
      key: 'name',
      header: 'Staff Personnel',
      sortable: true,
      sortFn: (a, b) => a.fullName.localeCompare(b.fullName),
      render: (s) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-semibold text-primary-700">
            {s.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="font-semibold text-foreground text-xs">{s.fullName}</p>
            <p className="text-xs text-muted-foreground font-mono">{s.staffId}</p>
          </div>
        </div>
      ),
    },
    { key: 'designation', header: 'Designation / Role', render: (s) => <span className="text-xs text-foreground font-medium">{s.designation}</span> },
    { key: 'department', header: 'Department', render: (s) => <span className="text-xs text-foreground">{s.departmentName}</span> },
    { key: 'contact', header: 'Contact', render: (s) => <span className="text-xs text-muted-foreground font-mono">{s.contactEmail || '—'}</span> },
    { key: 'biometric', header: 'Biometric Status', render: (s) => <BiometricStatusBadge status={s.biometricStatus} /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Staff Personnel Registry"
        subtitle="FR-12: Campus staff directory for gate turnstile clock-in and attendance verification"
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
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-section animate-fadeIn">
          <DataTable
            columns={columns}
            data={staff}
            isLoading={isLoading}
            searchPlaceholder="Search staff by name or ID..."
            searchFn={(s, q) => s.fullName.toLowerCase().includes(q) || s.staffId.toLowerCase().includes(q)}
            getRowId={(s) => s.id}
            emptyTitle="No staff found"
            emptyDescription="No staff records have been created yet."
            emptyAction={{ label: 'Register Staff', onClick: () => setIsRegisterModalOpen(true) }}
          />
        </div>
      </div>

      {/* Register Staff Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-md w-full p-6 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-foreground text-base">
                  Register Staff Member (FR-12.1)
                </h3>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterStaff} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Mr. Aliyu Bello"
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
                    placeholder="e.g. STF/GEN/021"
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
                  Designation / Operational Role
                </label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Administrative Officer"
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
                  Register Staff
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
