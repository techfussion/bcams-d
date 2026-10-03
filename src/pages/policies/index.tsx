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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/common/data-table';
import { PageSkeleton } from '@/components/common/empty-error-states';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { formatDate } from '@/lib/utils';
import type { Policy, PolicyType, PolicyScope, PolicyPunctualityValue } from '@/types';
import {
  ShieldCheck, Percent, Clock, MapPin, Plus, CheckCircle2,
  AlertCircle, Building2, SlidersHorizontal, Info
} from 'lucide-react';

export function PoliciesPage() {
  const { user } = useAuthStore();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [formType, setFormType] = useState<PolicyType>('attendance_threshold');
  const [formScope, setFormScope] = useState<PolicyScope>('department');
  const [formValue, setFormValue] = useState<string>('75');

  useEffect(() => {
    async function loadData() {
      try {
        const data = await api.getPolicies();
        // If HOD, filter to institution + their department
        if (user?.role === 'hod' && user.departmentId) {
          setPolicies(data.filter(p => p.scope === 'institution' || p.scopeId === user.departmentId));
        } else {
          setPolicies(data);
        }
      } catch (err) {
        console.error('Failed to load policies:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleCreatePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    const newPolicy: Policy = {
      id: `pol-${Date.now().toString().slice(-4)}`,
      type: formType,
      scope: formScope,
      scopeId: user?.departmentId || 'dept-cs',
      scopeName: user?.departmentName || 'Computer Science',
      value: formType === 'punctuality_hours' 
        ? { expectedStart: '08:30', expectedEnd: '16:30', graceMinutes: 45 } 
        : Number(formValue) || 75,
      effectiveFrom: new Date().toISOString().split('T')[0],
      createdBy: user?.fullName || 'Super Administrator',
      isActive: true,
    };

    setPolicies([newPolicy, ...policies]);
    setShowCreateModal(false);
  };

  const togglePolicyStatus = (id: string) => {
    setPolicies(policies.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p));
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
      header: 'Policy Rule',
      sortable: true,
      render: (policy) => {
        let icon = <Percent className="h-4 w-4 text-primary" />;
        let title = 'Attendance Threshold';
        if (policy.type === 'geofence_radius') {
          icon = <MapPin className="h-4 w-4 text-emerald-600" />;
          title = 'Geofence Radius';
        } else if (policy.type === 'punctuality_hours') {
          icon = <Clock className="h-4 w-4 text-amber-600" />;
          title = 'Punctuality & Working Hours';
        }
        return (
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-muted rounded-md">{icon}</div>
            <div>
              <p className="font-semibold text-foreground text-xs">{title}</p>
              <p className="text-[11px] text-muted-foreground">{policy.type}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'scope',
      header: 'Scope',
      sortable: true,
      render: (policy) => (
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={
              policy.scope === 'institution'
                ? "bg-purple-50 text-purple-700 border-purple-200 capitalize text-xs"
                : "bg-blue-50 text-blue-700 border-blue-200 capitalize text-xs"
            }
          >
            {policy.scope}
          </Badge>
          {policy.scopeName && (
            <span className="text-xs text-muted-foreground truncate max-w-[140px]">
              ({policy.scopeName})
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Configured Value',
      render: (policy) => (
        <span className="font-mono text-xs font-semibold text-foreground bg-muted/60 px-2 py-1 rounded">
          {formatPolicyValue(policy)}
        </span>
      ),
    },
    {
      key: 'effectiveFrom',
      header: 'Effective Date',
      render: (policy) => (
        <span className="text-xs text-muted-foreground font-mono">
          {formatDate(policy.effectiveFrom)}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (policy) => (
        <button
          onClick={() => togglePolicyStatus(policy.id)}
          className="focus:outline-none"
          title="Click to toggle policy state"
        >
          {policy.isActive ? (
            <Badge variant="outline" className="bg-success-50 text-success-700 border-success-200 gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3" />
              Active
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1 text-xs">
              <AlertCircle className="h-3 w-3" />
              Disabled
            </Badge>
          )}
        </button>
      ),
    },
    {
      key: 'createdBy',
      header: 'Author / Authority',
      render: (policy) => (
        <span className="text-xs text-muted-foreground truncate max-w-[140px] block">
          {policy.createdBy}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Institutional & Academic Policies"
        subtitle="FR-4: Configure attendance thresholds for exam eligibility, gate punctuality hours, and geofence standards."
        actions={
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="gap-2 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Policy Override
          </Button>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Policy Resolution Alert */}
        <div className="flex items-start gap-3 rounded-lg border border-primary-200 bg-primary-50 p-4 text-sm text-primary-900 shadow-sm">
          <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-primary-950">
              Policy Inheritance & Precedence Architecture
            </p>
            <p className="text-xs text-primary-800 leading-relaxed">
              BCAMS applies policies using hierarchical resolution: <strong>Course Override → Department Rule → Institutional Default</strong>.
              If a student is being evaluated for exam eligibility, their department threshold (e.g. 80%) supersedes the institutional minimum (70%).
            </p>
          </div>
        </div>

        {/* Highlight Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="shadow-sm border-l-4 border-l-primary">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Exam Eligibility Threshold
                </CardTitle>
                <Percent className="h-4 w-4 text-primary" />
              </div>
              <CardDescription className="text-xs">
                Minimum lectures attended required to sit for semester examinations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-foreground">70%</span>
                <span className="text-xs text-muted-foreground">institution baseline</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Computer Science requires 80% override.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Standard Geofence Radius
                </CardTitle>
                <MapPin className="h-4 w-4 text-emerald-600" />
              </div>
              <CardDescription className="text-xs">
                Maximum allowable physical distance from verified lecture hall venue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-foreground">200m</span>
                <span className="text-xs text-muted-foreground">perimeter boundary</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Biometric scans outside this perimeter are rejected with geofence alert.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Staff Punctuality Window
                </CardTitle>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <CardDescription className="text-xs">
                Gate arrival standard with allowable grace period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-foreground">09:00</span>
                <span className="text-xs text-muted-foreground">+60m grace</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Arrivals after 10:00 are automatically tagged as Late Arrival.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Policies Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Configured Rules & Overrides
              </h2>
              <p className="text-xs text-muted-foreground">
                All active and pending policies across faculties and institutional domains
              </p>
            </div>
          </div>

          <DataTable
            data={policies}
            columns={columns}
            searchable={true}
            searchPlaceholder="Search policies by rule type or scope..."
            emptyTitle="No policies found"
            emptyDescription="No institutional or departmental policies configured."
          />
        </div>
      </div>

      {/* Add Policy Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border shadow-xl max-w-md w-full p-6 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-semibold text-foreground text-base">
                Create Policy Rule
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePolicy} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Policy Type
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as PolicyType)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="attendance_threshold">Attendance Threshold (%)</option>
                  <option value="geofence_radius">Geofence Radius (meters)</option>
                  <option value="punctuality_hours">Punctuality Working Hours</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Scope
                </label>
                <select
                  value={formScope}
                  onChange={(e) => setFormScope(e.target.value as PolicyScope)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="department">Department Override</option>
                  <option value="institution">Institution-wide</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Value {formType === 'attendance_threshold' ? '(%)' : formType === 'geofence_radius' ? '(Meters)' : ''}
                </label>
                <input
                  type="number"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  className="w-full text-xs h-9 rounded-md border border-input bg-background px-3 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. 75"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="default" size="sm">
                  Save Policy
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
