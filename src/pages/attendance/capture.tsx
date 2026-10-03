/**
 * Attendance Capture Page
 * 
 * The most important BCAMS interface — biometric capture during an active session.
 * 
 * States: Ready → Scanning → Processing → Success/Duplicate/NoMatch/GeofenceRejected/Error
 * 
 * CRITICAL (Addendum 1): No manual attendance override exists anywhere.
 * The only actions on a failed scan are: retry, try different finger, or exit.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SessionStatusBadge, ScannerStatusIndicator, ConnectionIndicator } from '@/components/common/status-indicators';
import { PageSkeleton } from '@/components/common/empty-error-states';
import { scannerService } from '@/services/scanner-service';
import { useSyncStore } from '@/stores/sync-store';
import { api } from '@/api';
import { formatTime, cn } from '@/lib/utils';
import type { Session, CaptureResult, ScannerState, GeofenceStatus } from '@/types';
import {
  Fingerprint, CheckCircle2, XCircle, AlertTriangle, Copy,
  MapPin, MapPinOff, WifiOff, ArrowLeft, StopCircle, RotateCcw,
  Users, Clock,
} from 'lucide-react';

type CapturePhase = 'ready' | 'scanning' | 'processing' | 'result';

export function AttendanceCapturePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { connection } = useSyncStore();
  
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scannerState, setScannerState] = useState<ScannerState>('disconnected');
  const [capturePhase, setCapturePhase] = useState<CapturePhase>('ready');
  const [lastResult, setLastResult] = useState<CaptureResult | null>(null);
  const [captureCount, setCaptureCount] = useState(0);
  const [recentCaptures, setRecentCaptures] = useState<Array<{ id: string; name?: string; type: string; time: string }>>([
    { id: 'rc-1', name: 'Oluwaseun Adeyemi', type: 'success', time: '10:05 AM' },
    { id: 'rc-2', name: 'Ngozi Chukwuma', type: 'success', time: '10:06 AM' },
  ]);
  const [geofenceStatus, setGeofenceStatus] = useState<GeofenceStatus>('inside');

  useEffect(() => {
    if (!sessionId) return;
    api.getSession(sessionId).then(s => {
      setSession(s);
      setIsLoading(false);
    });
  }, [sessionId]);

  // Scanner connection
  useEffect(() => {
    const unsubscribe = scannerService.onStateChange(setScannerState);
    scannerService.connect();
    return () => {
      unsubscribe();
    };
  }, []);

  const handleCapture = useCallback(async () => {
    if (scannerState === 'disconnected') return;
    if (geofenceStatus === 'outside') {
      setLastResult({ type: 'geofence_rejected', timestamp: new Date().toISOString() });
      setCapturePhase('result');
      setTimeout(() => setCapturePhase('ready'), 3500);
      return;
    }

    setCapturePhase('scanning');
    setLastResult(null);

    const result = await scannerService.startCapture();
    
    setLastResult(result);
    setCapturePhase('result');
    setCaptureCount(c => c + 1);

    // Track in live recent captures list
    const newCapture = {
      id: `rc-${Date.now().toString().slice(-4)}`,
      name: 'personName' in result ? result.personName : result.type === 'no_match' ? 'Unmatched Fingerprint' : 'Rejected Scan',
      type: result.type,
      time: formatTime(new Date().toISOString()),
    };
    setRecentCaptures(prev => [newCapture, ...prev.slice(0, 7)]);

    // FR-3: If verified capture, add to pending sync queue
    if (result.type === 'success' && 'personName' in result) {
      useSyncStore.getState().addPendingItem({
        type: 'attendance',
        description: `${result.personName} — ${session?.courseCode || 'Class'}`,
        timestamp: new Date().toISOString(),
      });
    }

    // Auto-reset to ready after showing result
    setTimeout(() => {
      setCapturePhase('ready');
    }, 3000);
  }, [scannerState, geofenceStatus, session]);

  const handleCloseSession = () => {
    if (!session) return;
    navigate(`/sessions/${session.id}`);
  };

  if (isLoading) return <PageSkeleton />;
  if (!session) return null;

  const scannerConnected = scannerState !== 'disconnected';

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <Header
        title="Attendance Capture"
        subtitle={`${session.courseCode} — ${session.courseTitle}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/sessions/${session.id}`)}>
              <ArrowLeft className="h-4 w-4" />
              Back to Session
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseSession}
              className="gap-1.5 text-rose-700 hover:bg-rose-50 border-rose-200"
            >
              <StopCircle className="h-4 w-4 text-rose-600" />
              Close Session
            </Button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="p-page space-y-6 animate-fade-in">
          {/* Status Bar */}
          <div className="flex items-center justify-between bg-white rounded-lg border border-border px-5 py-3 shadow-xs">
            <div className="flex items-center gap-6">
              <ScannerStatusIndicator connected={scannerConnected} />
              <ConnectionIndicator status={connection} />
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-body-medium">{session.attendanceCount + captureCount}</span>
                <span className="text-muted-foreground">/ {session.enrolledCount} attended</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SessionStatusBadge state={session.state} />
              
              {/* Geofence Simulator Toggle for testing FR-10.5 */}
              <button
                onClick={() => setGeofenceStatus(g => g === 'inside' ? 'outside' : 'inside')}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1.5 ${
                  geofenceStatus === 'inside'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}
                title="Click to toggle geofence testing"
              >
                <MapPin className="h-3 w-3" />
                {geofenceStatus === 'inside' ? 'Geofence: Inside Venue (200m)' : 'Geofence: OUTSIDE (Violations Rejected)'}
              </button>

              {connection === 'offline' && (
                <Badge variant="warning">
                  <WifiOff className="h-3 w-3" /> Offline Mode
                </Badge>
              )}
            </div>
          </div>

          {/* Main Capture Area */}
          <div className="flex gap-6">
            {/* Capture Panel */}
            <div className="flex-1">
              <Card className={cn(
                'transition-all duration-300 shadow-sm',
                capturePhase === 'ready' && scannerConnected && 'bcams-scanner-ready',
                capturePhase === 'scanning' && 'bcams-scanner-processing',
                capturePhase === 'processing' && 'bcams-scanner-processing',
                capturePhase === 'result' && lastResult?.type === 'success' && 'bcams-scanner-success',
                capturePhase === 'result' && lastResult?.type === 'duplicate' && 'border-2 border-warning bg-warning-50/30',
                capturePhase === 'result' && (lastResult?.type === 'no_match' || lastResult?.type === 'error') && 'bcams-scanner-error',
                capturePhase === 'result' && lastResult?.type === 'geofence_rejected' && 'bcams-scanner-error',
                !scannerConnected && 'bcams-scanner-disconnected',
              )}>
                <CardContent className="flex flex-col items-center justify-center py-16 px-8">
                  {/* Geofence Rejected */}
                  {geofenceStatus === 'outside' && capturePhase === 'ready' ? (
                    <GeofenceRejectedState />
                  ) : !scannerConnected ? (
                    /* Scanner Disconnected */
                    <ScannerDisconnectedState onRetry={() => scannerService.connect()} />
                  ) : capturePhase === 'ready' ? (
                    /* Ready State */
                    <ReadyState onCapture={handleCapture} />
                  ) : capturePhase === 'scanning' ? (
                    /* Scanning State */
                    <ScanningState />
                  ) : capturePhase === 'processing' ? (
                    /* Processing State */
                    <ProcessingState />
                  ) : lastResult ? (
                    /* Result State */
                    <ResultState result={lastResult} onRetry={handleCapture} />
                  ) : null}
                </CardContent>
              </Card>
            </div>

            {/* Recent Captures Panel */}
            <div className="w-80">
              <Card className="shadow-sm">
                <CardContent className="pt-card-padding">
                  <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
                    <h3 className="text-card-heading text-xs uppercase tracking-wider font-bold">Live Capture Feed</h3>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {session.attendanceCount + captureCount} Total
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {recentCaptures.map(rc => (
                      <div
                        key={rc.id}
                        className="p-2.5 rounded-lg border border-border bg-background flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-semibold text-foreground truncate max-w-[170px]">{rc.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{rc.time}</p>
                        </div>
                        <Badge
                          variant={rc.type === 'success' ? 'success' : rc.type === 'duplicate' ? 'warning' : 'destructive'}
                          className="text-[10px] uppercase font-mono"
                        >
                          {rc.type === 'success' ? 'Verified' : rc.type === 'duplicate' ? 'Duplicate' : 'Rejected'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Capture Sub-States ─────────────────────────────────────────────────────

function ReadyState({ onCapture }: { onCapture: () => void }) {
  return (
    <div className="text-center space-y-4">
      <div className="relative inline-block">
        <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center">
          <Fingerprint className="h-12 w-12 text-primary" />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-pulse-ring" />
      </div>
      <div>
        <h2 className="text-section-heading text-primary-700">Ready to Scan</h2>
        <p className="text-body text-muted-foreground mt-1">Place finger on scanner</p>
      </div>
      <Button onClick={onCapture} size="lg" className="mt-4">
        <Fingerprint className="h-5 w-5" />
        Capture Fingerprint
      </Button>
    </div>
  );
}

function ScanningState() {
  return (
    <div className="text-center space-y-4">
      <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center relative overflow-hidden">
        <Fingerprint className="h-12 w-12 text-primary" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/20 to-transparent animate-scan-line" />
      </div>
      <div>
        <h2 className="text-section-heading">Scanning…</h2>
        <p className="text-body text-muted-foreground mt-1">Keep finger steady on scanner</p>
      </div>
    </div>
  );
}

function ProcessingState() {
  return (
    <div className="text-center space-y-4">
      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spinner" />
      </div>
      <div>
        <h2 className="text-section-heading">Processing…</h2>
        <p className="text-body text-muted-foreground mt-1">Matching fingerprint</p>
      </div>
    </div>
  );
}

function ResultState({ result, onRetry }: { result: CaptureResult; onRetry: () => void }) {
  switch (result.type) {
    case 'success':
      return (
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-success-100 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <div>
            <h2 className="text-section-heading text-success-700">✓ Attendance Recorded</h2>
            <p className="text-lg font-medium mt-2">{result.personName}</p>
            <p className="text-body text-muted-foreground">{formatTime(result.timestamp)}</p>
          </div>
        </div>
      );

    case 'duplicate':
      return (
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-warning-100 flex items-center justify-center">
            <Copy className="h-10 w-10 text-warning" />
          </div>
          <div>
            <h2 className="text-section-heading text-warning-700">Already Recorded</h2>
            <p className="text-lg font-medium mt-2">{result.personName}</p>
            <p className="text-body text-muted-foreground">
              Already recorded at {formatTime(result.originalTimestamp)}
            </p>
          </div>
        </div>
      );

    case 'no_match':
      return (
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-destructive-100 flex items-center justify-center">
            <XCircle className="h-10 w-10 text-destructive" />
          </div>
          <div>
            <h2 className="text-section-heading text-destructive">× No Match Found</h2>
            <p className="text-body text-muted-foreground mt-1">
              No enrolled identity matched this fingerprint.
            </p>
            <p className="text-helper text-muted-foreground mt-1">
              Try again with a different registered finger, or verify enrollment status.
            </p>
          </div>
          {/* No manual override — only retry (Addendum 1) */}
          <Button variant="outline" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" />
            Retry Scan
          </Button>
        </div>
      );

    case 'geofence_rejected':
      return <GeofenceRejectedState />;

    case 'error':
      return (
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-destructive-100 flex items-center justify-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          <div>
            <h2 className="text-section-heading text-destructive">Capture Error</h2>
            <p className="text-body text-muted-foreground mt-1">{result.message}</p>
          </div>
          <Button variant="outline" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      );
  }
}

function GeofenceRejectedState() {
  return (
    <div className="text-center space-y-4">
      <div className="w-20 h-20 rounded-full bg-destructive-100 flex items-center justify-center">
        <MapPinOff className="h-10 w-10 text-destructive" />
      </div>
      <div>
        <h2 className="text-section-heading text-destructive">× Outside Approved Location</h2>
        <p className="text-body text-muted-foreground mt-1 max-w-sm">
          Attendance cannot be recorded because this device is outside the approved geofence boundary for this course.
        </p>
        <p className="text-helper text-muted-foreground mt-2">
          Move to the approved teaching location and try again.
        </p>
      </div>
    </div>
  );
}

function ScannerDisconnectedState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center space-y-4">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
        <Fingerprint className="h-10 w-10 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-section-heading text-muted-foreground">Scanner Disconnected</h2>
        <p className="text-body text-muted-foreground mt-1 max-w-sm">
          No fingerprint scanner is connected. Please connect a scanner via USB or Bluetooth.
        </p>
      </div>
      <Button variant="outline" onClick={onRetry}>
        <RotateCcw className="h-4 w-4" />
        Retry Connection
      </Button>
    </div>
  );
}
