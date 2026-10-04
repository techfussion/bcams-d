/**
 * Policy Creation Form Dialog
 * 
 * Zod-validated modal for establishing institutional, departmental,
 * or course-level attendance policies (SRS FR-5).
 */
import React, { useState } from 'react';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Policy, PolicyType, PolicyScope, Department, Course } from '@/types';
import { ShieldAlert, AlertCircle } from 'lucide-react';

const policySchema = z.object({
  type: z.enum(['attendance_threshold', 'session_duration', 'geofence_radius', 'biometric_enrollment', 'staff_gate_hours', 'punctuality_hours']),
  scope: z.enum(['institution', 'department', 'course']),
  thresholdPercentage: z.number().min(50).max(100).optional(),
  geofenceRadius: z.number().min(20).max(1000).optional(),
  graceMinutes: z.number().min(0).max(180).optional(),
});

interface PolicyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Department[];
  courses: Course[];
  onSubmit: (policy: Policy) => void;
}

export function PolicyFormDialog({
  open,
  onOpenChange,
  departments,
  courses,
  onSubmit,
}: PolicyFormDialogProps) {
  const [type, setType] = useState<PolicyType>('attendance_threshold');
  const [scope, setScope] = useState<PolicyScope>('institution');
  const [scopeId, setScopeId] = useState<string>('');
  const [threshold, setThreshold] = useState<number>(75);
  const [geofenceRadius, setGeofenceRadius] = useState<number>(200);
  const [graceMinutes, setGraceMinutes] = useState<number>(60);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      policySchema.parse({
        type,
        scope,
        thresholdPercentage: type === 'attendance_threshold' ? threshold : undefined,
        geofenceRadius: type === 'geofence_radius' ? geofenceRadius : undefined,
        graceMinutes: (type === 'punctuality_hours' || type === 'staff_gate_hours') ? graceMinutes : undefined,
      });

      let scopeName: string | undefined;
      if (scope === 'department') {
        const dept = departments.find((d) => d.id === scopeId);
        scopeName = dept ? dept.name : departments[0]?.name;
      } else if (scope === 'course') {
        const crs = courses.find((c) => c.id === scopeId);
        scopeName = crs ? crs.code : courses[0]?.code;
      }

      let policyValue: Policy['value'] = threshold;
      if (type === 'geofence_radius') {
        policyValue = geofenceRadius;
      } else if (type === 'punctuality_hours' || type === 'staff_gate_hours') {
        policyValue = {
          expectedStart: '09:00',
          expectedEnd: '17:00',
          graceMinutes,
        };
      }

      const newPolicy: Policy = {
        id: `pol-${Date.now().toString().slice(-4)}`,
        type,
        scope,
        scopeId: scope !== 'institution' ? scopeId || (scope === 'department' ? departments[0]?.id : courses[0]?.id) : undefined,
        scopeName: scope === 'institution' ? 'All Faculties' : scopeName,
        value: policyValue,
        effectiveFrom: new Date().toISOString().split('T')[0],
        createdBy: 'Administrator',
        isActive: true,
      };

      onSubmit(newPolicy);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) {
            fieldErrors[String(e.path[0])] = e.message;
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary-50 text-primary flex items-center justify-center">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle>Create Governance Policy</DialogTitle>
                <DialogDescription className="text-xs">
                  Configure attendance thresholds, geofence radius, or punctuality rules.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Policy Rule Type
                </label>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as PolicyType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="attendance_threshold">Attendance Threshold</SelectItem>
                    <SelectItem value="geofence_radius">Geofence Radius</SelectItem>
                    <SelectItem value="staff_gate_hours">Staff Gate Hours (9am-5pm + Grace)</SelectItem>
                    <SelectItem value="session_duration">Session Timeout Duration</SelectItem>
                    <SelectItem value="biometric_enrollment">Biometric Enrollment Target</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-medium text-foreground block mb-1">
                  Enforcement Scope
                </label>
                <Select
                  value={scope}
                  onValueChange={(v) => {
                    const s = v as PolicyScope;
                    setScope(s);
                    if (s === 'department' && departments[0]) setScopeId(departments[0].id);
                    if (s === 'course' && courses[0]) setScopeId(courses[0].id);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="institution">Institutional (All)</SelectItem>
                    <SelectItem value="department">Departmental</SelectItem>
                    <SelectItem value="course">Course Specific</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Scope target selection if department or course */}
            {scope === 'department' && (
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Target Department
                </label>
                <Select value={scopeId || departments[0]?.id} onValueChange={setScopeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scope === 'course' && (
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Target Course
                </label>
                <Select value={scopeId || courses[0]?.id} onValueChange={setScopeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} — {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Value Inputs based on Type */}
            {type === 'attendance_threshold' && (
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Minimum Attendance Threshold (%)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={50}
                    max={100}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-muted-foreground text-xs">
                    (Students below this percentage are flagged or barred from exams)
                  </span>
                </div>
              </div>
            )}

            {type === 'geofence_radius' && (
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Authorized Geofence Radius (meters)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={20}
                    max={1000}
                    step={10}
                    value={geofenceRadius}
                    onChange={(e) => setGeofenceRadius(Number(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-muted-foreground text-xs">
                    (Acceptable distance from scheduled venue coordinates)
                  </span>
                </div>
              </div>
            )}

            {(type === 'punctuality_hours' || type === 'staff_gate_hours') && (
              <div>
                <label className="font-medium text-foreground block mb-1">
                  Grace Period Window (minutes)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={graceMinutes}
                    onChange={(e) => setGraceMinutes(Number(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-muted-foreground text-xs">
                    (Window after scheduled start before student is marked Late)
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Policy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
