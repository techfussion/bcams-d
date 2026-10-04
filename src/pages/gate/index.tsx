/**
 * Staff Gate Attendance Operational Kiosk
 * 
 * Dedicated operational workspace for Staff Gate Capturers.
 * Features:
 * - Local scanner hardware status (ready, scanning, processing)
 * - Local workstation network & sync status
 * - Live scan trigger & immediate biometric verification feedback
 * - Automatic Clock-In / Clock-Out determination
 * - Statutory Punctuality classification (9:00 AM standard, 60m grace up to 10:00 AM)
 * - Local recent scan feed for this physical turnstile endpoint
 * - No administrative records browsing or global data controls
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScannerStatusIndicator, ConnectionIndicator } from '@/components/common/status-indicators';
import { api } from '@/api';
import { scannerService } from '@/services/scanner-service';
import { useAuthStore } from '@/stores/auth-store';
import { useSyncStore } from '@/stores/sync-store';
import { formatTime } from '@/lib/utils';
import { isSuperAdmin, isGateCapturer } from '@/lib/permissions';
import type { ScannerState, ClockEvent } from '@/types';
import {
  DoorOpen, LogIn, LogOut, CheckCircle2, AlertTriangle,
  Clock, ShieldCheck, Fingerprint, RefreshCw, ExternalLink,
} from 'lucide-react';

export function GateAttendancePage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { connection, pendingEvents, lastSyncAt, syncNow } = useSyncStore();

  const [scannerState, setScannerState] = useState<ScannerState>('ready');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<{
    success: boolean;
    staffName: string;
    staffId: string;
    department: string;
    type: 'clock_in' | 'clock_out';
    punctuality?: 'on-time' | 'late';
    timestamp: string;
    message: string;
  } | null>(null);

  // Local turnstile activity feed (just the scans processed on this workstation)
  const [recentTerminalScans, setRecentTerminalScans] = useState<ClockEvent[]>([]);

  useEffect(() => {
    const unsub = scannerService.onStateChange(setScannerState);
    scannerService.connect();
    return () => unsub();
  }, []);

  const handleCaptureGateScan = async () => {
    if (isScanning) return;
    setIsScanning(true);

    try {
      // Execute scanner verification
      const scan = await scannerService.simulateScan();

      if (scan.type === 'success') {
        const now = new Date();
        const currentHour = now.getHours();

        // If afternoon/evening (>= 14:00), treat as Clock Out; otherwise Clock In
        const eventType: 'clock_in' | 'clock_out' = currentHour >= 14 ? 'clock_out' : 'clock_in';

        // 9:00 AM + 60m grace window = deadline 10:00 AM
        const isLate = currentHour > 10 || (currentHour === 10 && now.getMinutes() > 0);
        const punctuality = eventType === 'clock_in' ? (isLate ? 'late' : 'on-time') : undefined;

        const clockEvent: ClockEvent = {
          id: `gate-${Date.now().toString(36)}`,
          staffId: scan.registrationNumber || 'STF/001',
          staffName: scan.personName,
          staffDepartment: 'University Personnel',
          type: eventType,
          punctuality,
          timestamp: now.toISOString(),
          deviceId: 'dev-gate-turnstile-01',
          clockIntegrity: 'verified',
          syncStatus: 'synced',
        };

        await api.recordClockEvent(clockEvent);

        setLastScanResult({
          success: true,
          staffName: scan.personName,
          staffId: scan.registrationNumber || 'STF/001',
          department: 'University Personnel',
          type: eventType,
          punctuality,
          timestamp: now.toISOString(),
          message: eventType === 'clock_in'
            ? `Clocked In • ${punctuality === 'on-time' ? 'On-Time Arrival' : 'Late Arrival'}`
            : 'Clocked Out • Departure Confirmed',
        });

        setRecentTerminalScans(prev => [clockEvent, ...prev.slice(0, 7)]);
      } else if (scan.type === 'duplicate') {
        setLastScanResult({
          success: true,
          staffName: scan.personName,
          staffId: 'STF/STAFF',
          department: 'University Personnel',
          type: 'clock_in',
          timestamp: new Date().toISOString(),
          message: 'Extra scan detected: Already recorded for this shift.',
        });
      } else {
        setLastScanResult({
          success: false,
          staffName: 'Unrecognized Personnel',
          staffId: 'NO MATCH',
          department: 'N/A',
          type: 'clock_in',
          timestamp: new Date().toISOString(),
          message: 'Biometric template not found in institutional registry.',
        });
      }
    } catch (err) {
      setLastScanResult({
        success: false,
        staffName: 'Hardware Error',
        staffId: 'ERR',
        department: 'N/A',
        type: 'clock_in',
        timestamp: new Date().toISOString(),
        message: 'Scanner transmission error. Please retry verification.',
      });
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50/50">
      <Header
        title="Gate Attendance Kiosk"
        subtitle="Staff Gate Capturer operational workstation. Turnstile biometric entrance and exit terminal."
        actions={
          <div className="flex items-center gap-2">
            {isSuperAdmin(user) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/gate/records')}
                className="gap-2 text-xs border-primary/30 text-primary hover:bg-primary-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Administrative Gate Ledger
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncNow()}
              className="gap-2 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync Station
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-5xl mx-auto w-full">
        {/* Workstation Hardware & Telemetry Bar */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
                <Fingerprint className="h-5 w-5" />
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
              <p className="text-xs text-muted-foreground font-medium">Workstation Network</p>
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
            Endpoint: North Main Security Gate
          </Badge>
        </div>

        {/* Central Scan Terminal Interactive Card */}
        <Card className="border-2 border-primary/20 shadow-md overflow-hidden bg-white">
          <CardContent className="p-8 flex flex-col items-center text-center">
            <div className="relative mb-6">
              <div className={`h-28 w-28 rounded-full flex items-center justify-center transition-all duration-300 ${
                isScanning
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
              {isScanning ? 'Scanning Fingerprint...' : 'Ready for Staff Verification'}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mt-1.5">
              Ask staff member to place their enrolled index or thumb finger firmly onto the turnstile optical reader.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                onClick={handleCaptureGateScan}
                disabled={isScanning}
                className="gap-2.5 bg-primary hover:bg-primary-600 text-white font-semibold px-8 shadow-sm text-sm"
              >
                <Fingerprint className="h-5 w-5" />
                {isScanning ? 'Processing Verification...' : 'Trigger Biometric Capture'}
              </Button>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Working Hours: <strong>9:00 AM – 5:00 PM</strong> (60m grace period)</span>
            </div>
          </CardContent>

          {/* Immediate Live Scan Result Banner */}
          {lastScanResult && (
            <div className={`border-t p-5 flex items-center justify-between ${
              lastScanResult.success
                ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                : 'bg-rose-50/90 border-rose-200 text-rose-900'
            }`}>
              <div className="flex items-center gap-3.5">
                <div className={`p-2 rounded-full ${
                  lastScanResult.success ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {lastScanResult.success ? (
                    lastScanResult.type === 'clock_in' ? <LogIn className="h-5 w-5" /> : <LogOut className="h-5 w-5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5" />
                  )}
                </div>
                <div>
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
              No scans captured on this terminal yet today. Press "Trigger Biometric Capture" above to verify personnel.
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
