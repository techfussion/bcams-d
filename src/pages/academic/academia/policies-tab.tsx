/**
 * Academia — Institutional Attendance Policies Tab
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/api';
import { useToast } from '@/hooks';
import { captureCurrentCoordinates } from '@/services/geolocation-service';
import type { Policy, PolicyGeofenceValue, PolicyPunctualityValue } from '@/types';
import {
  ShieldCheck, MapPin, Clock, Fingerprint, Award,
  AlertTriangle, CheckCircle2, Navigation, RefreshCw,
  Info, Loader2, Save,
} from 'lucide-react';

interface PoliciesTabProps {
  policies: Policy[];
  onRefresh: () => Promise<void>;
}

export function PoliciesTab({ policies, onRefresh }: PoliciesTabProps) {
  const { toast } = useToast();

  // Numerical policies state
  const [attendanceThreshold, setAttendanceThreshold] = useState<number>(70);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(120);
  const [minimumBiometricFingers, setMinimumBiometricFingers] = useState<number>(4);
  const [expectedStartTime, setExpectedStartTime] = useState<string>('09:00');
  const [expectedEndTime, setExpectedEndTime] = useState<string>('17:00');
  const [staffGraceMinutes, setStaffGraceMinutes] = useState<number>(60);
  const [isSavingPolicies, setIsSavingPolicies] = useState(false);

  // Geofence configuration state
  const [savedGeofence, setSavedGeofence] = useState<PolicyGeofenceValue | null>(null);
  const [geofenceRadius, setGeofenceRadius] = useState<number>(200);

  // Live Location Capture state
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [captureError, setCaptureError] = useState<{ code: string; message: string } | null>(null);
  const [pendingCapture, setPendingCapture] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: string;
  } | null>(null);
  const [isSavingGeofence, setIsSavingGeofence] = useState(false);

  // Initialize values from active institutional policies
  useEffect(() => {
    // 1. Attendance threshold
    const threshPolicy = policies.find(p => p.type === 'attendance_threshold' && p.scope === 'institution');
    if (threshPolicy && typeof threshPolicy.value === 'number') {
      setAttendanceThreshold(threshPolicy.value);
    }

    // 2. Session timeout
    const timeoutPolicy = policies.find(p => p.type === 'session_duration' && p.scope === 'institution');
    if (timeoutPolicy && typeof timeoutPolicy.value === 'number') {
      setSessionTimeoutMinutes(timeoutPolicy.value);
    }

    // 3. Biometric fingers
    const bioPolicy = policies.find(p => p.type === 'biometric_enrollment' && p.scope === 'institution');
    if (bioPolicy && typeof bioPolicy.value === 'number') {
      setMinimumBiometricFingers(bioPolicy.value);
    }

    // 4. Staff gate hours & grace
    const gatePolicy = policies.find(
      p => (p.type === 'staff_gate_hours' || p.type === 'punctuality_hours') && p.scope === 'institution'
    );
    if (gatePolicy && typeof gatePolicy.value === 'object' && gatePolicy.value !== null) {
      const gVal = gatePolicy.value as PolicyPunctualityValue;
      if (gVal.expectedStart) setExpectedStartTime(gVal.expectedStart);
      if (gVal.expectedEnd) setExpectedEndTime(gVal.expectedEnd);
      if (typeof gVal.graceMinutes === 'number') setStaffGraceMinutes(gVal.graceMinutes);
    }

    // 5. Geofence
    const geoPolicy = policies.find(
      p => (p.type === 'geofence_radius' || p.type === 'geofence_configuration') && p.scope === 'institution'
    );
    if (geoPolicy) {
      if (typeof geoPolicy.value === 'object' && geoPolicy.value !== null) {
        const val = geoPolicy.value as PolicyGeofenceValue;
        if (typeof val.latitude === 'number' && typeof val.longitude === 'number') {
          setSavedGeofence(val);
        }
        if (val.radiusMeters) setGeofenceRadius(val.radiusMeters);
      } else if (typeof geoPolicy.value === 'number') {
        setGeofenceRadius(geoPolicy.value);
      }
    }
  }, [policies]);

  // Real location capture trigger
  const handleCaptureLocation = async () => {
    setIsCapturingLocation(true);
    setCaptureError(null);
    setPendingCapture(null);

    try {
      const result = await captureCurrentCoordinates();
      if (!result.success || !result.coords) {
        setCaptureError({
          code: result.error?.code || 'UNKNOWN',
          message: result.error?.message || 'Failed to acquire location coordinates from device.',
        });
      } else {
        setPendingCapture({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracy: result.coords.accuracy,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setCaptureError({
        code: 'HARDWARE_ERROR',
        message: err?.message || 'Unexpected failure while querying device geolocation provider.',
      });
    } finally {
      setIsCapturingLocation(false);
    }
  };

  // Confirm and persist captured geofence coordinates
  const handleConfirmSaveGeofence = async () => {
    if (!pendingCapture) return;
    setIsSavingGeofence(true);
    try {
      const newGeofenceVal: PolicyGeofenceValue = {
        latitude: pendingCapture.latitude,
        longitude: pendingCapture.longitude,
        radiusMeters: geofenceRadius,
        accuracy: pendingCapture.accuracy,
        capturedAt: pendingCapture.timestamp,
        capturedBy: 'Super Administrator',
      };

      await api.saveInstitutionalPolicies([
        {
          type: 'geofence_radius',
          title: 'Classroom Geofence Perimeter Enforcement Policy',
          description: 'Permitted spatial radius around approved teaching venues. Class sessions and student scans outside this perimeter are rejected.',
          scope: 'institution',
          value: newGeofenceVal,
          isActive: true,
        },
      ]);

      setSavedGeofence(newGeofenceVal);
      setPendingCapture(null);

      toast({
        title: 'Geofence Configured',
        description: `Campus perimeter set to (${newGeofenceVal.latitude?.toFixed(6)}, ${newGeofenceVal.longitude?.toFixed(6)}) with ${geofenceRadius}m radius.`,
        variant: 'success',
      });
      await onRefresh();
    } catch (err: any) {
      toast({
        title: 'Save Failed',
        description: err?.message || 'Failed to persist geofence configuration',
        variant: 'destructive',
      });
    } finally {
      setIsSavingGeofence(false);
    }
  };

  // Save all numerical institutional policies
  const handleSaveNumericalPolicies = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPolicies(true);
    try {
      await api.saveInstitutionalPolicies([
        {
          type: 'attendance_threshold',
          title: 'Institutional Minimum Examination Clearance Rule',
          description: 'Statutory minimum attendance percentage required for undergraduate examination clearance.',
          scope: 'institution',
          value: Number(attendanceThreshold),
          isActive: true,
        },
        {
          type: 'session_duration',
          title: 'Class Attendance Capture Session Auto-Timeout Rule',
          description: 'Maximum allowable continuous session duration. Active lecture sessions automatically terminate after this limit.',
          scope: 'institution',
          value: Number(sessionTimeoutMinutes),
          isActive: true,
        },
        {
          type: 'biometric_enrollment',
          title: 'Biometric Enrollment & Quality Threshold Standards',
          description: 'Minimum verified finger captures required for student and staff identity activation.',
          scope: 'institution',
          value: Number(minimumBiometricFingers),
          isActive: true,
        },
        {
          type: 'staff_gate_hours',
          title: 'Staff Gate Clock-In & Punctuality Classification Policy',
          description: 'Expected working hours with institutional grace period for punctuality classification.',
          scope: 'institution',
          value: {
            expectedStart: expectedStartTime,
            expectedEnd: expectedEndTime,
            graceMinutes: Number(staffGraceMinutes),
          },
          isActive: true,
        },
      ]);

      toast({
        title: 'Institutional Policies Saved',
        description: 'Attendance thresholds, timeouts, and staff gate parameters updated across the institution.',
        variant: 'success',
      });
      await onRefresh();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to update institutional policies',
        variant: 'destructive',
      });
    } finally {
      setIsSavingPolicies(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── SECTION 1: Geofence Configuration Workflow ───────────────────── */}
      <Card className="border border-border/80 shadow-xs">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  Institutional Campus Geofence Perimeter
                </CardTitle>
                <CardDescription className="text-xs">
                  Physical location boundary enforcement. Classroom sessions and attendance captures are validated against these coordinates.
                </CardDescription>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleCaptureLocation}
              disabled={isCapturingLocation}
              className="gap-1.5 shadow-sm text-xs bg-blue-600 hover:bg-blue-700 text-white self-start sm:self-auto"
            >
              {isCapturingLocation ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spinner" />
                  Acquiring Geolocation...
                </>
              ) : (
                <>
                  <Navigation className="h-3.5 w-3.5" />
                  Capture Current Location
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-4">
          {/* Current Saved Coordinates Status */}
          {savedGeofence ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                  Configured Coordinates
                </span>
                <span className="font-mono font-medium text-foreground text-xs block mt-0.5">
                  Lat: {savedGeofence.latitude?.toFixed(6)}° N
                </span>
                <span className="font-mono font-medium text-foreground text-xs block">
                  Lon: {savedGeofence.longitude?.toFixed(6)}° E
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                  Perimeter Enforcement Radius
                </span>
                <span className="font-semibold text-foreground text-xs block mt-0.5">
                  {savedGeofence.radiusMeters} metres
                </span>
                {savedGeofence.accuracy && (
                  <span className="text-[11px] text-muted-foreground block">
                    Sensor Accuracy: ±{Math.round(savedGeofence.accuracy)}m
                  </span>
                )}
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                  Capture Verification
                </span>
                <span className="text-emerald-700 font-medium text-xs flex items-center gap-1 mt-0.5">
                  Verified Physical Location
                </span>
                {savedGeofence.capturedAt && (
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    Updated: {new Date(savedGeofence.capturedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-lg bg-amber-50/50 border border-amber-200/70 flex items-start gap-3 text-xs text-amber-900">
              <div>
                <span className="font-semibold block">No Geofence Coordinates Configured</span>
                <p className="text-[11px] text-amber-800/90 mt-0.5">
                  BCAMS requires real coordinates explicitly acquired via device sensors.
                  Click <strong>Capture Current Location</strong> while positioned on campus to calibrate the perimeter.
                </p>
              </div>
            </div>
          )}

          {/* Location Capture Failure Banner */}
          {captureError && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 flex items-start justify-between gap-3 text-xs text-rose-900">
              <div className="flex items-start gap-2.5">
                <div>
                  <span className="font-semibold block text-xs">
                    Location Capture Failed ({captureError.code.replace('_', ' ')})
                  </span>
                  <p className="text-[11px] text-rose-800 mt-0.5">{captureError.message}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCaptureLocation}
                className="h-7 text-xs border-rose-300 text-rose-700 hover:bg-rose-100 flex-shrink-0"
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Retry
              </Button>
            </div>
          )}

          {/* Pending Capture Review Card */}
          {pendingCapture && (
            <div className="p-4 rounded-lg bg-blue-50/60 border border-blue-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-900 font-semibold">
                  Review Captured Geolocation Coordinates
                </div>
                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-[10px]">
                  Unconfirmed
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-2.5 rounded bg-white border border-blue-100">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Latitude</span>
                  <span className="font-mono font-bold text-foreground text-sm">{pendingCapture.latitude.toFixed(6)}°</span>
                </div>
                <div className="p-2.5 rounded bg-white border border-blue-100">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Longitude</span>
                  <span className="font-mono font-bold text-foreground text-sm">{pendingCapture.longitude.toFixed(6)}°</span>
                </div>
                <div className="p-2.5 rounded bg-white border border-blue-100">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Sensor Accuracy</span>
                  <span className="font-bold text-foreground text-sm">
                    {pendingCapture.accuracy ? `±${Math.round(pendingCapture.accuracy)}m` : 'Hardware default'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-2">
                <div className="max-w-xs">
                  <label className="font-medium text-foreground block mb-1">
                    Permitted Geofence Radius (metres)
                  </label>
                  <Input
                    type="number"
                    min={20}
                    max={1000}
                    value={geofenceRadius}
                    onChange={(e) => setGeofenceRadius(Number(e.target.value))}
                    className="h-8 text-xs bg-white"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Permitted radius around teaching facilities (20m – 1,000m). Default: 200m.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPendingCapture(null)}
                    className="h-8 text-xs"
                  >
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConfirmSaveGeofence}
                    disabled={isSavingGeofence}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  >
                    {isSavingGeofence ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spinner" /> Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" /> Confirm & Save Geofence
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── SECTION 2: Numerical Institutional Policies Form ─────────────── */}
      <Card className="border border-border/80 shadow-xs">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div>
              <CardTitle className="text-sm font-semibold">
                Institutional Attendance & Operational Rules
              </CardTitle>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5">
          <form onSubmit={handleSaveNumericalPolicies} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              {/* 1. Attendance Clearance Threshold */}
              <div className="p-4 rounded-lg bg-slate-50/60 border border-slate-200/70 space-y-2">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  Minimum Examination Clearance Threshold
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Statutory minimum attendance percentage required for undergraduate students to sit semester examinations.
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <Input
                    type="number"
                    min={50}
                    max={100}
                    value={attendanceThreshold}
                    onChange={(e) => setAttendanceThreshold(Number(e.target.value))}
                    className="h-8 w-24 bg-white text-xs font-semibold"
                  />
                </div>
              </div>

              {/* 2. Lecture Session Timeout */}
              <div className="p-4 rounded-lg bg-slate-50/60 border border-slate-200/70 space-y-2">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  Class Session Auto-Timeout Duration
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Maximum allowable continuous class session duration. Active lecture sessions automatically terminate after this limit.
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <Input
                    type="number"
                    min={30}
                    max={360}
                    value={sessionTimeoutMinutes}
                    onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))}
                    className="h-8 w-24 bg-white text-xs font-semibold"
                  />
                </div>
              </div>

              {/* 3. Minimum Biometric Enrollment */}
              <div className="p-4 rounded-lg bg-slate-50/60 border border-slate-200/70 space-y-2">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  Minimum Biometric Finger Activation Standard
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Minimum number of fingerprint templates (target 10) required for student/staff biometric profile activation.
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={minimumBiometricFingers}
                    onChange={(e) => setMinimumBiometricFingers(Number(e.target.value))}
                    className="h-8 w-24 bg-white text-xs font-semibold"
                  />
                </div>
              </div>

              {/* 4. Staff Clock-In Grace Period & Working Hours */}
              <div className="p-4 rounded-lg bg-slate-50/60 border border-slate-200/70 space-y-2">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  Staff Gate Hours & Clock-In Grace Period
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Working hours and arrival grace window. Scans after scheduled start plus grace period are classified as Late.
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Start</label>
                    <Input
                      type="text"
                      placeholder="09:00"
                      value={expectedStartTime}
                      onChange={(e) => setExpectedStartTime(e.target.value)}
                      className="h-8 bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">End</label>
                    <Input
                      type="text"
                      placeholder="17:00"
                      value={expectedEndTime}
                      onChange={(e) => setExpectedEndTime(e.target.value)}
                      className="h-8 bg-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">Grace (min)</label>
                    <Input
                      type="number"
                      min={0}
                      max={180}
                      value={staffGraceMinutes}
                      onChange={(e) => setStaffGraceMinutes(Number(e.target.value))}
                      className="h-8 bg-white text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <span className="text-helper text-muted-foreground">
                Settings take effect immediately for new sessions and gate scans. Historical attendance is preserved.
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingPolicies}
                className="gap-1.5 shadow-sm text-xs bg-primary text-white"
              >
                {isSavingPolicies ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spinner" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" /> Save Institutional Policies
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
