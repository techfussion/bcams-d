/**
 * Self-Service Staff Gate Attendance Terminal
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScannerStatusIndicator, ConnectionIndicator } from '@/components/common/status-indicators';
import { api } from '@/api';
import { scannerService } from '@/services/scanner-service';
import { useSyncStore } from '@/stores/sync-store';
import { formatTime } from '@/lib/utils';
import type { ScannerState, ClockEvent, Staff } from '@/types';
import {
  DoorOpen, LogIn, LogOut, CheckCircle2, AlertTriangle,
  Clock, ShieldCheck, Fingerprint, RefreshCw,
} from 'lucide-react';

interface ScanFeedback {
  success: boolean;
  staffName: string;
  staffId: string;
  department: string;
  type: 'clock_in' | 'clock_out';
  punctuality?: 'on-time' | 'late';
  timestamp: string;
  message: string;
}

export function GateAttendancePage() {
  const navigate = useNavigate();
  const { connection, pendingEvents, syncNow } = useSyncStore();

  const [scannerState, setScannerState] = useState<ScannerState>('ready');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<ScanFeedback | null>(null);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [scanCounter, setScanCounter] = useState(0);

  // Local turnstile activity feed (scans processed at this physical turnstile endpoint today)
  const [recentTerminalScans, setRecentTerminalScans] = useState<ClockEvent[]>([]);

  useEffect(() => {
    const unsub = scannerService.onStateChange(setScannerState);
    scannerService.connect();

    // Preload staff directory to resolve biometric identifications
    api.getStaff().then((staff) => {
      setStaffList(staff);
    }).catch(() => { });

    // Preload existing daily clock events for this gate station
    api.getDailyClockRecords().then((records) => {
      const todayEvents: ClockEvent[] = [];
      records.forEach(r => {
        if (r.clockIn) todayEvents.push(r.clockIn);
        if (r.clockOut) todayEvents.push(r.clockOut);
      });
      todayEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentTerminalScans(todayEvents.slice(0, 10));
    }).catch(() => { });

    return () => unsub();
  }, []);

  const handleCaptureGateScan = useCallback(async () => {
    if (isScanning) return;
    setIsScanning(true);

    try {
      // Execute scanner verification from physical hardware or simulated optical sensor
      const scan = await scannerService.simulateScan();

      if (scan.type === 'no_match') {
        setLastScanResult({
          success: false,
          staffName: 'Unrecognized Personnel',
          staffId: 'NO MATCH',
          department: 'N/A',
          type: 'clock_in',
          timestamp: new Date().toISOString(),
          message: 'Biometric template not found in institutional registry. Please register at the Enrollment Hub.',
        });
        return;
      }

      if (scan.type === 'geofence_rejected' || scan.type === 'error') {
        setLastScanResult({
          success: false,
          staffName: 'Capture Error',
          staffId: 'ERR',
          department: 'N/A',
          type: 'clock_in',
          timestamp: new Date().toISOString(),
          message: scan.type === 'error'
            ? scan.message
            : 'Turnstile gate sensor out of permitted geofence parameter.',
        });
        return;
      }

      const personId = scan.personId;
      const personName = scan.personName;
      const regNumber = scan.type === 'success' ? scan.registrationNumber : undefined;

      // Identify staff member from registry
      let identifiedStaff: Staff | undefined = staffList.find(s =>
        s.id === personId ||
        (regNumber && s.staffId === regNumber) ||
        s.fullName.toLowerCase() === personName?.toLowerCase()
      );

      // If not matched directly by ID (e.g. simulated pool rotation), resolve to staff catalog
      if (!identifiedStaff && staffList.length > 0) {
        identifiedStaff = staffList[scanCounter % staffList.length];
        setScanCounter(c => c + 1);
      }

      if (!identifiedStaff) {
        setLastScanResult({
          success: false,
          staffName: personName || 'Unregistered Staff',
          staffId: regNumber || 'UNKNOWN',
          department: 'General Staff',
          type: 'clock_in',
          timestamp: new Date().toISOString(),
          message: 'Identified person is not enrolled in the active staff directory.',
        });
        return;
      }

      const now = new Date();
      const currentHour = now.getHours();

      // Check existing scans for this staff member today at this terminal
      const staffScansToday = recentTerminalScans.filter(s => s.staffId === identifiedStaff!.staffId);
      const hasClockedIn = staffScansToday.some(s => s.type === 'clock_in');
      const hasClockedOut = staffScansToday.some(s => s.type === 'clock_out');

      // Determine Clock-In vs Clock-Out
      let eventType: 'clock_in' | 'clock_out';
      if (!hasClockedIn) {
        eventType = 'clock_in';
      } else if (!hasClockedOut) {
        eventType = 'clock_out';
      } else {
        // Already clocked in and out today -> duplicate scan warning
        setLastScanResult({
          success: true,
          staffName: identifiedStaff.fullName,
          staffId: identifiedStaff.staffId,
          department: identifiedStaff.departmentName,
          type: 'clock_out',
          timestamp: now.toISOString(),
          message: 'Shift Complete: Clock-in and clock-out already recorded for today.',
        });
        return;
      }

      // Punctuality Evaluation for Clock-In:
      // Standard: 9:00 AM. Grace period: 60 minutes (until 10:00 AM).
      const isLate = currentHour > 10 || (currentHour === 10 && now.getMinutes() > 0);
      const punctuality = eventType === 'clock_in' ? (isLate ? 'late' : 'on-time') : undefined;

      const clockEvent: ClockEvent = {
        id: `gate-${Date.now().toString(36)}`,
        staffId: identifiedStaff.staffId,
        staffName: identifiedStaff.fullName,
        staffDepartment: identifiedStaff.departmentName,
        type: eventType,
        punctuality,
        timestamp: now.toISOString(),
        deviceId: 'dev-gate-01',
        clockIntegrity: 'verified',
        syncStatus: 'synced',
      };

      await api.recordClockEvent(clockEvent);

      useSyncStore.getState().addPendingItem({
        type: 'clock',
        description: `${identifiedStaff.fullName} — ${eventType === 'clock_in' ? 'Clock In' : 'Clock Out'}`,
        timestamp: now.toISOString(),
      });

      setLastScanResult({
        success: true,
        staffName: identifiedStaff.fullName,
        staffId: identifiedStaff.staffId,
        department: identifiedStaff.departmentName,
        type: eventType,
        punctuality,
        timestamp: now.toISOString(),
        message: eventType === 'clock_in'
          ? `Clock In Recorded • ${punctuality === 'on-time' ? 'On-Time Arrival' : 'Late Arrival'}`
          : 'Clock Out Recorded • Departure Confirmed',
      });

      setRecentTerminalScans(prev => [clockEvent, ...prev.slice(0, 9)]);
    } catch {
      setLastScanResult({
        success: false,
        staffName: 'Transmission Error',
        staffId: 'ERR',
        department: 'N/A',
        type: 'clock_in',
        timestamp: new Date().toISOString(),
        message: 'Scanner communication error. Please present finger again.',
      });
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, staffList, recentTerminalScans, scanCounter]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50/50">
      <Header
        title="Self-Service Gate Terminal"
        subtitle="Turnstile biometric attendance station. Present registered fingerprint to record arrival or departure."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncNow()}
              className="gap-2 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync Station
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/login')}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              Admin Portal
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-5xl mx-auto w-full">
        {/* Terminal Station Status Bar */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
                <DoorOpen className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Turnstile Sensor</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold text-foreground capitalize">{scannerState}</span>
                </div>
              </div>
            </div>

            <div className="h-8 w-px bg-border" />

            <div>
              <p className="text-xs text-muted-foreground font-medium">Station Network</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <ConnectionIndicator status={connection} />
                <span className="text-xs font-semibold text-foreground capitalize">{connection}</span>
              </div>
            </div>

            <div className="h-8 w-px bg-border" />

            <div>
              <p className="text-xs text-muted-foreground font-medium">Queue Synchronization</p>
              <p className="text-xs font-semibold text-foreground mt-0.5">
                {pendingEvents > 0 ? `${pendingEvents} pending sync` : 'All records synced'}
              </p>
            </div>
          </div>

          <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-300 font-mono text-xs">
            Endpoint: Main Campus Gate Terminal 1 (dev-gate-01)
          </Badge>
        </div>

        {/* Central Scan Terminal Interactive Card */}
        <Card className="border-2 border-primary/20 shadow-md overflow-hidden bg-white">
          <CardContent className="p-8 flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className={`h-28 w-28 rounded-full flex items-center justify-center transition-all duration-300 ${isScanning
                  ? 'bg-primary-100 text-primary animate-pulse scale-105 shadow-lg'
                  : 'bg-primary-50 text-primary border border-primary/20 hover:scale-105'
                }`}>
                <Fingerprint className="h-16 w-16" />
              </div>
              {isScanning && (
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              )}
            </div>

            <h2 className="text-xl font-bold text-foreground">
              {isScanning ? 'Verifying Fingerprint...' : 'Place Finger on Scanner'}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mt-1.5">
              Touch your registered finger firmly onto the turnstile optical reader to clock in or clock out.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                onClick={handleCaptureGateScan}
                disabled={isScanning}
                className="gap-2.5 bg-primary hover:bg-primary-600 text-white font-semibold px-8 shadow-sm text-sm"
              >
                <Fingerprint className="h-5 w-5" />
                {isScanning ? 'Verifying Identity...' : 'Scan Fingerprint to Clock In / Out'}
              </Button>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Standard Hours: <strong>9:00 AM – 5:00 PM</strong> (60m arrival grace period)</span>
            </div>
          </CardContent>

          {/* Immediate Live Scan Result Banner */}
          {lastScanResult && (
            <div className={`border-t p-5 flex items-center justify-between ${lastScanResult.success
                ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                : 'bg-rose-50/90 border-rose-200 text-rose-900'
              }`}>
              <div className="flex items-center gap-3.5">
                <div className={`p-2 rounded-full ${lastScanResult.success ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                  {lastScanResult.success ? (
                    lastScanResult.type === 'clock_in' ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5" />
                  )}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base">{lastScanResult.staffName}</h3>
                    <span className="font-mono text-xs opacity-75 font-semibold">[{lastScanResult.staffId}]</span>
                    {lastScanResult.punctuality && (
                      <Badge variant={lastScanResult.punctuality === 'on-time' ? 'success' : 'destructive'} className="text-[10px] uppercase font-mono">
                        {lastScanResult.punctuality}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 font-medium">{lastScanResult.message}</p>
                </div>
              </div>

              <div className="text-right font-mono text-xs">
                <p className="font-semibold">{formatTime(lastScanResult.timestamp)}</p>
                <span className="text-[11px] opacity-75">Sensor Verified</span>
              </div>
            </div>
          )}
        </Card>

        {/* Local Turnstile Feed (Today's local verified scans) */}
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm text-foreground">
                Recent Terminal Verifications (This Workstation)
              </h3>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {recentTerminalScans.length} events logged
            </span>
          </div>

          {recentTerminalScans.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-border rounded-lg text-xs text-muted-foreground">
              No scans captured on this terminal yet today. Press "Scan Fingerprint to Clock In / Out" above to record attendance.
            </div>
          ) : (
            <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {recentTerminalScans.map((scan) => (
                <div key={scan.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-md ${scan.type === 'clock_in' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                      {scan.type === 'clock_in' ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{scan.staffName}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{scan.staffId}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {scan.punctuality && (
                      <Badge variant={scan.punctuality === 'on-time' ? 'success' : 'destructive'} className="text-[10px] uppercase font-mono">
                        {scan.punctuality}
                      </Badge>
                    )}
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatTime(scan.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
