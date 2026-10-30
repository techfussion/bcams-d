/**
 * Academia — Departments & HODs Tab
 * 
 * Central management for academic departments and Head of Department (HOD) assignments.
 * Supports viewing, creating, editing departments, and assigning, replacing, or removing HODs.
 */
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DepartmentFormDialog } from '@/components/academic/department-form-dialog';
import { api } from '@/api';
import { useToast } from '@/hooks';
import type { Department, Staff } from '@/types';
import {
  Building2, Plus, Search, UserCheck, UserX,
  Edit2, Users, BookOpen, GraduationCap, ShieldAlert,
} from 'lucide-react';

interface DepartmentsTabProps {
  departments: Department[];
  staff: Staff[];
  onRefresh: () => Promise<void>;
}

export function DepartmentsTab({ departments, staff, onRefresh }: DepartmentsTabProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Edit Department state
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editFaculty, setEditFaculty] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Assign/Replace HOD modal state
  const [hodModalDept, setHodModalDept] = useState<Department | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [isAssigningHOD, setIsAssigningHOD] = useState(false);

  // Remove HOD confirmation state
  const [deptToRemoveHOD, setDeptToRemoveHOD] = useState<Department | null>(null);
  const [isRemovingHOD, setIsRemovingHOD] = useState(false);

  const filteredDepartments = departments.filter((dept) => {
    const q = searchQuery.toLowerCase();
    return (
      dept.name.toLowerCase().includes(q) ||
      dept.code.toLowerCase().includes(q) ||
      (dept.faculty && dept.faculty.toLowerCase().includes(q)) ||
      (dept.hodName && dept.hodName.toLowerCase().includes(q))
    );
  });

  const handleCreateDepartment = async (newDept: Department) => {
    try {
      await api.createDepartment(newDept);
      toast({
        title: 'Department Created',
        description: `${newDept.name} (${newDept.code}) has been established.`,
        variant: 'success',
      });
      await onRefresh();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to create department',
        variant: 'destructive',
      });
    }
  };

  const handleStartEdit = (dept: Department) => {
    setEditingDept(dept);
    setEditName(dept.name);
    setEditCode(dept.code);
    setEditFaculty(dept.faculty || '');
  };

  const handleSaveEdit = async () => {
    if (!editingDept) return;
    setIsSavingEdit(true);
    try {
      await api.updateDepartment(editingDept.id, {
        name: editName.trim(),
        code: editCode.trim().toUpperCase(),
        faculty: editFaculty.trim(),
      });
      toast({
        title: 'Department Updated',
        description: `${editName} details saved successfully.`,
        variant: 'success',
      });
      setEditingDept(null);
      await onRefresh();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to update department',
        variant: 'destructive',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleOpenAssignHOD = (dept: Department) => {
    setHodModalDept(dept);
    setSelectedStaffId('');
  };

  const handleAssignHOD = async () => {
    if (!hodModalDept || !selectedStaffId) return;
    setIsAssigningHOD(true);
    try {
      await api.assignHOD(selectedStaffId, hodModalDept.id);
      const chosenStaff = staff.find(s => s.id === selectedStaffId || s.staffId === selectedStaffId);
      toast({
        title: 'HOD Assigned',
        description: `${chosenStaff?.fullName || 'Staff'} is now Head of Department for ${hodModalDept.name}.`,
        variant: 'success',
      });
      setHodModalDept(null);
      await onRefresh();
    } catch (err: any) {
      toast({
        title: 'Assignment Failed',
        description: err?.message || 'Failed to assign Head of Department',
        variant: 'destructive',
      });
    } finally {
      setIsAssigningHOD(false);
    }
  };

  const handleConfirmRemoveHOD = async () => {
    if (!deptToRemoveHOD) return;
    setIsRemovingHOD(true);
    try {
      const staffMember = staff.find(s => s.id === deptToRemoveHOD.hodId || s.fullName === deptToRemoveHOD.hodName);
      await api.assignHOD(staffMember?.id || 'none', deptToRemoveHOD.id, true);
      toast({
        title: 'HOD Removed',
        description: `Head of Department removed from ${deptToRemoveHOD.name}. Staff member identity preserved.`,
        variant: 'success',
      });
      setDeptToRemoveHOD(null);
      await onRefresh();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to remove HOD',
        variant: 'destructive',
      });
    } finally {
      setIsRemovingHOD(false);
    }
  };

  // Eligible staff for HOD assignment (academic or any staff with staff identity)
  const eligibleStaff = staff.filter(s => !s.isHOD || s.hodDepartmentId === hodModalDept?.id);

  return (
    <div className="space-y-6">
      {/* Top action bar & stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search departments, codes, faculties, or HODs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Department
          </Button>
        </div>
      </div>

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredDepartments.map((dept) => {
          const assignedStaff = staff.find(s => s.id === dept.hodId || (dept.hodName && s.fullName === dept.hodName));
          return (
            <Card key={dept.id} className="border border-border shadow-xs hover:border-primary/40 transition-colors">
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                          {dept.name}
                          <Badge variant="outline" className="font-mono text-xs px-1.5 py-0">
                            {dept.code}
                          </Badge>
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{dept.faculty}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStartEdit(dept)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      title="Edit Department"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* HOD Status Banner */}
                  <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase tracking-wider font-medium">
                        Head of Department (HOD)
                      </span>
                      {dept.hodName ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="font-semibold text-foreground">{dept.hodName}</span>
                          {assignedStaff?.staffId && (
                            <span className="text-[10px] text-muted-foreground font-mono">({assignedStaff.staffId})</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-amber-700 font-medium italic mt-0.5 block">No HOD assigned</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {dept.hodName ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenAssignHOD(dept)}
                            className="h-7 text-[11px] px-2"
                          >
                            Replace
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeptToRemoveHOD(dept)}
                            className="h-7 text-[11px] px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            title="Remove HOD assignment"
                          >
                            <UserX className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleOpenAssignHOD(dept)}
                          className="h-7 text-[11px] px-2.5 bg-primary text-white"
                        >
                          Assign HOD
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Metrics Footer */}
                <div className="grid grid-cols-4 gap-2 text-center pt-3 border-t border-border">
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] text-muted-foreground uppercase flex items-center justify-center gap-1">
                      <GraduationCap className="h-3 w-3" /> Students
                    </p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{dept.studentCount}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] text-muted-foreground uppercase flex items-center justify-center gap-1">
                      <Users className="h-3 w-3" /> Lecturers
                    </p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{dept.lecturerCount}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] text-muted-foreground uppercase flex items-center justify-center gap-1">
                      <Users className="h-3 w-3" /> Staff
                    </p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{dept.staffCount || 0}</p>
                  </div>
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-[10px] text-muted-foreground uppercase flex items-center justify-center gap-1">
                      <BookOpen className="h-3 w-3" /> Courses
                    </p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{dept.courseCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Department Form Dialog */}
      <DepartmentFormDialog
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSubmit={handleCreateDepartment}
      />

      {/* Edit Department Dialog */}
      <Dialog open={Boolean(editingDept)} onOpenChange={(open) => !open && setEditingDept(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Edit Academic Department</DialogTitle>
            <DialogDescription className="text-xs">
              Update official name, institutional code, or faculty affiliation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-3 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">Department Name *</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Department name"
              />
            </div>
            <div>
              <label className="font-medium text-foreground block mb-1">Department Code *</label>
              <Input
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                placeholder="e.g. CSC"
                className="font-mono"
              />
            </div>
            <div>
              <label className="font-medium text-foreground block mb-1">Faculty Affiliation *</label>
              <Input
                value={editFaculty}
                onChange={(e) => setEditFaculty(e.target.value)}
                placeholder="Faculty name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingDept(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={isSavingEdit || !editName || !editCode}>
              {isSavingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign / Replace HOD Dialog */}
      <Dialog open={Boolean(hodModalDept)} onOpenChange={(open) => !open && setHodModalDept(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {hodModalDept?.hodName ? 'Replace Head of Department' : 'Assign Head of Department'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Appoint an eligible staff member to lead {hodModalDept?.name} ({hodModalDept?.code}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            {hodModalDept?.hodName && (
              <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/60 text-amber-900">
                <span className="font-semibold block text-[11px]">Current Leadership:</span>
                <p className="mt-0.5 text-xs">{hodModalDept.hodName}</p>
                <p className="text-[10px] text-amber-800/80 mt-1">
                  Assigning a new staff member will transfer the HOD responsibility and update departmental administrative access.
                </p>
              </div>
            )}

            <div>
              <label className="font-medium text-foreground block mb-1.5">
                Select Staff Member *
              </label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Search or select staff member..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {eligibleStaff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.fullName} • {s.staffId} ({s.designation || 'Academic Staff'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70 text-muted-foreground text-[11px] space-y-1">
              <p className="font-semibold text-foreground">Institutional Governance Policy:</p>
              <p>• HOD is an appointed administrative responsibility linked to an existing staff member.</p>
              <p>• The staff member retains their academic rank, lecturer role, and teaching course history.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setHodModalDept(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAssignHOD}
              disabled={isAssigningHOD || !selectedStaffId}
            >
              {isAssigningHOD ? 'Assigning...' : 'Confirm Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove HOD Confirmation Dialog */}
      <Dialog open={Boolean(deptToRemoveHOD)} onOpenChange={(open) => !open && setDeptToRemoveHOD(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Remove Head of Department</DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to remove the HOD assignment for {deptToRemoveHOD?.name}?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-xs text-muted-foreground space-y-2">
            <p>
              Current HOD: <strong className="text-foreground">{deptToRemoveHOD?.hodName}</strong>
            </p>
            <p className="text-[11px] bg-slate-50 p-2.5 rounded border border-slate-200">
              This action only revokes departmental administrative authority. The staff member's record, teaching courses, and biometric profile are preserved.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeptToRemoveHOD(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmRemoveHOD}
              disabled={isRemovingHOD}
            >
              {isRemovingHOD ? 'Removing...' : 'Remove HOD'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
