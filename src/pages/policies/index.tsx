/**
 * Policies Management Page
 * 
 * FR-4: Institutional and departmental policies:
 * - Minimum attendance threshold for exam eligibility (e.g. 70%, 75%, 80%)
 * - Punctuality hours & grace period
 * - Geofence radius defaults
 * - Hierarchical override logic (Course -> Department -> Institution)
 */
import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { PolicyFormDialog } from '@/components/policies';
import { PageSkeleton } from '@/components/common/empty-error-states';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/hooks';
import { formatDate } from '@/lib/utils';
import type { Policy, PolicyPunctualityValue, Department, Course } from '@/types';
import {
  ShieldCheck,
  Percent,
  Clock,
  MapPin,
  Plus,
  CheckCircle2,
  AlertCircle,
  Building2,
  SlidersHorizontal,
  Info,
} from 'lucide-react';

export function PoliciesPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>([]);

  // Deactivation confirmation state
  const [deactivateTarget, setDeactivateTarget] = useState<Policy | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [polData, deptData, courseData] = await Promise.all([
          api.getPolicies(),
          api.getDepartments(),
          api.getCourses(),
        ]);
        setDepartments(deptData);
        setCourses(courseData);

        if (user?.role === 'hod' && user.departmentId) {
          setPolicies(
            polData.filter(
              (p) => p.scope === 'institution' || p.scopeId === user.departmentId
            )
          );
        } else {
          setPolicies(polData);
        }
      } catch (err) {
        console.error('Failed to load policies:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handlePolicyCreated = (newPolicy: Policy) => {
    setPolicies([newPolicy, ...policies]);
    toast({
      title: 'Policy Created',
      description: `New ${newPolicy.type.replace('_', ' ')} policy has been established for ${newPolicy.scope}.`,
      variant: 'success',
    });
  };

  const promptToggleStatus = (policy: Policy) => {
    if (policy.isActive) {
      setDeactivateTarget(policy);
    } else {
      executeToggle(policy.id, true);
    }
  };

  const executeToggle = (id: string, nextActiveState: boolean) => {
    setPolicies((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isActive: nextActiveState } : p))
    );
    toast({
      title: nextActiveState ? 'Policy Activated' : 'Policy Deactivated',
      description: nextActiveState
        ? 'Governance policy is now actively enforced.'
        : 'Policy rule has been disabled and will no longer apply to evaluations.',
      variant: nextActiveState ? 'success' : 'default',
    });
    setDeactivateTarget(null);
  };

  if (isLoading) {
    return <PageSkeleton />;
  }

  const formatPolicyValue = (policy: Policy) => {
    if (policy.type === 'attendance_threshold') {
      return `${policy.value}% attendance required`;
    }
    if (policy.type === 'geofence_radius') {
      return `${policy.value} meters radius`;
    }
    if (policy.type === 'punctuality_hours') {
      const v = policy.value as PolicyPunctualityValue;
      return `${v.expectedStart} - ${v.expectedEnd} (${v.graceMinutes}m grace)`;
    }
    return String(policy.value);
  };

  const columns: DataTableColumn<Policy>[] = [
    {
      key: 'type',
      header: 'Policy Rule Type',
      sortable: true,
      sortFn: (a, b) => a.type.localeCompare(b.type),
      render: (p) => {
        const icons = {
          attendance_threshold: <Percent className="h-4 w-4 text-primary" />,
          punctuality_hours: <Clock className="h-4 w-4 text-amber-600" />,
          geofence_radius: <MapPin className="h-4 w-4 text-blue-600" />,
        };
        const labels = {
          attendance_threshold: 'Attendance Threshold (FR-4.1)',
          punctuality_hours: 'Punctuality & Working Hours',
          geofence_radius: 'Geofence Radius Perimeter',
        };
        return (
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-muted/60">
              {icons[p.type] || <ShieldCheck className="h-4 w-4 text-primary" />}
            </div>
            <div>
              <p className="font-semibold text-foreground text-xs">{labels[p.type] || p.type}</p>
              <p className="text-[11px] text-muted-foreground">ID: {p.id}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'scope',
      header: 'Scope Hierarchy',
      sortable: true,
      sortFn: (a, b) => a.scope.localeCompare(b.scope),
      render: (p) => {
        const scopeVariants: Record<string, 'default' | 'outline' | 'muted'> = {
          institution: 'default',
          department: 'outline',
          course: 'muted',
        };
        return (
          <div className="flex items-center gap-2">
            <Badge
              variant={scopeVariants[p.scope] || 'outline'}
              className="capitalize text-[11px] font-medium"
            >
              {p.scope}
            </Badge>
            {p.scopeName && (
              <span className="text-xs text-muted-foreground">{p.scopeName}</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'value',
      header: 'Enforced Constraint',
      render: (p) => (
        <span className="font-semibold text-foreground text-xs font-mono">
          {formatPolicyValue(p)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Active State',
      render: (p) =>
        p.isActive ? (
          <Badge variant="success" className="gap-1 text-[11px]">
            <CheckCircle2 className="h-3 w-3" /> Active
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground text-[11px]">
            Disabled
          </Badge>
        ),
    },
    {
      key: 'effectiveFrom',
      header: 'Effective Date',
      render: (p) => (
        <span className="text-xs text-muted-foreground font-mono">
          {formatDate(p.effectiveFrom)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (p) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => promptToggleStatus(p)}
          className={`h-7 px-2 text-[11px] ${
            p.isActive ? 'text-amber-700 hover:bg-amber-50' : 'text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          {p.isActive ? 'Disable' : 'Enable'}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Policy Engine & Governance"
        subtitle="Configure institutional attendance thresholds, geofence radius validation, and department-level overrides."
        actions={
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Create Policy
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Scope Hierarchy Explanation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="shadow-xs border-primary/20 bg-primary-50/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-primary font-semibold text-xs mb-1">
                <ShieldCheck className="h-4 w-4" />
                <span>Level 1: Course Specific</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Highest priority. Directly binds to specific course offerings and overrides faculty defaults.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-blue-200 bg-blue-50/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-700 font-semibold text-xs mb-1">
                <Building2 className="h-4 w-4" />
                <span>Level 2: Departmental</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Applies to all courses within a department when no course-specific policy is declared.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-border bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-foreground font-semibold text-xs mb-1">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <span>Level 3: Institutional Fallback</span>
              </div>
              <p className="text-xs text-muted-foreground">
                University baseline (e.g. 75% attendance threshold) enforced when no specialized overrides exist.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Policies Table */}
        <div className="space-y-4">
          <DataTable
            data={policies}
            columns={columns}
            searchable={true}
            searchPlaceholder="Search policies by rule type or scope..."
            emptyTitle="No policies found"
            emptyDescription="No institutional or departmental policies configured."
            selectable={true}
            selectedIds={selectedPolicyIds}
            onSelectionChange={setSelectedPolicyIds}
          />
        </div>
      </div>

      {/* Policy Creation Dialog */}
      <PolicyFormDialog
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        departments={departments}
        courses={courses}
        onSubmit={handlePolicyCreated}
      />

      {/* Deactivate Policy Confirmation */}
      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate Governance Policy?"
        description={`Are you sure you want to disable this ${deactivateTarget?.type.replace('_', ' ')} policy? Deactivating will cause students in this scope to fall back to the institutional baseline.`}
        variant="warning"
        confirmLabel="Disable Policy"
        onConfirm={() => {
          if (deactivateTarget) {
            executeToggle(deactivateTarget.id, false);
          }
        }}
      />
    </div>
  );
}
