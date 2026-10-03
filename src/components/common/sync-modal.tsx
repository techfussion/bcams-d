/**
 * Sync & Clock Integrity Center
 * 
 * Interactive inspection drawer/dialog for:
 * - Real-time synchronization state & manual trigger
 * - Offline queue inspection (Attendance, Clock, Audit)
 * - FR-4 Monotonic-Clock Cross-Check Calibration Pair
 * - Clock drift anomaly simulation and review
 */
import React from 'react';
import { useSyncStore } from '@/stores/sync-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClockIntegrityBadge } from '@/components/common/status-indicators';
import { formatTime, formatDateTime } from '@/lib/utils';
import {
  RefreshCw, Wifi, WifiOff, ShieldCheck, ShieldAlert,
  Clock, Server, Cpu, AlertTriangle, ArrowRight, PlayCircle, RotateCcw, CheckCircle2
} from 'lucide-react';

export function SyncCenterModal() {
  const {
    connection,
    pendingItems,
    lastSyncAt,
    syncingNow,
    calibrationPair,
    isSyncModalOpen,
    closeSyncModal,
    toggleConnection,
    syncNow,
    simulateClockDriftTest,
    simulateOfflineRebootTest,
  } = useSyncStore();

  if (!isSyncModalOpen) return null;

  const suspiciousCount = pendingItems.filter(i => i.clockIntegrity === 'suspicious').length;
  const unverifiedCount = pendingItems.filter(i => i.clockIntegrity === 'unverified').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-100 text-primary-700">
              <RefreshCw className={`h-5 w-5 ${syncingNow ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Sync & Clock Integrity Center
              </h2>
              <p className="text-xs text-muted-foreground">
                FR-3 Offline Sync Engine & FR-4 Monotonic-Clock Cross-Check
              </p>
            </div>
          </div>
          <button
            onClick={closeSyncModal}
            className="text-muted-foreground hover:text-foreground text-sm font-medium p-1 rounded-md"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-border bg-background space-y-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                Network Transport
              </span>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {connection === 'online' ? (
                    <Wifi className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-amber-600" />
                  )}
                  <span className="text-sm font-bold text-foreground capitalize">
                    {connection}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleConnection}
                  className="h-7 px-2 text-xs"
                >
                  Toggle
                </Button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-background space-y-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                Unsynced Queue
              </span>
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold text-foreground">
                    {pendingItems.length}
                  </span>
                  <span className="text-xs text-muted-foreground">events</span>
                </div>
                {suspiciousCount > 0 && (
                  <Badge variant="warning" className="text-[10px] gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    {suspiciousCount} Suspicious
                  </Badge>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-background space-y-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                Last Authoritative Sync
              </span>
              <p className="text-xs font-mono font-semibold text-foreground truncate">
                {lastSyncAt ? formatTime(lastSyncAt) : 'Never'}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {lastSyncAt ? formatDateTime(lastSyncAt).split(' ')[0] : 'Pending initial connection'}
              </p>
            </div>
          </div>

          {/* FR-4 Clock Integrity Section */}
          <div className="p-4 rounded-xl border border-primary-200 bg-primary-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary-950">
                  FR-4 Monotonic Calibration Anchor
                </h3>
              </div>
              <Badge variant="outline" className="text-[10px] border-primary-300 text-primary-800 bg-white">
                5-Min Anomaly Threshold
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-white p-3 rounded-lg border border-primary-100">
              <div>
                <span className="text-muted-foreground text-[10px] block">Server Wall Clock</span>
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <Server className="h-3 w-3 text-primary" />
                  {formatTime(calibrationPair.serverWallClock)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px] block">Hardware Monotonic Clock</span>
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <Cpu className="h-3 w-3 text-primary" />
                  {(calibrationPair.deviceMonotonicMs / 1000).toFixed(1)}s elapsed
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-muted-foreground mr-1">Tamper-Check Tests:</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => simulateClockDriftTest(15)}
                className="h-7 text-[11px] gap-1 bg-white hover:bg-amber-50 text-amber-800 border-amber-300"
              >
                <AlertTriangle className="h-3 w-3 text-amber-600" />
                Simulate 15m Clock Tamper
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={simulateOfflineRebootTest}
                className="h-7 text-[11px] gap-1 bg-white hover:bg-slate-50 text-slate-800 border-slate-300"
              >
                <RotateCcw className="h-3 w-3 text-slate-600" />
                Simulate Offline Reboot
              </Button>
            </div>
          </div>

          {/* Queue Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Offline Event Queue ({pendingItems.length})
              </h3>
              <span className="text-[11px] text-muted-foreground">
                Idempotent Ingestion on Event ID (FR-3.3)
              </span>
            </div>

            {pendingItems.length === 0 ? (
              <div className="text-center py-8 border border-dashed rounded-xl bg-muted/20 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-foreground">All events synchronized with backend</p>
                <p className="text-[11px]">No pending records in local encrypted storage.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {pendingItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-border bg-background flex items-center justify-between hover:border-primary/40 transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {item.description}
                        </span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {item.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                        <span>Time: {formatTime(item.timestamp)}</span>
                        <span>Device: {item.deviceId}</span>
                      </div>
                    </div>

                    <div>
                      <ClockIntegrityBadge status={item.clockIntegrity} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={closeSyncModal}>
            Close
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={syncNow}
            disabled={syncingNow || connection === 'offline' || pendingItems.length === 0}
            className="gap-2 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${syncingNow ? 'animate-spin' : ''}`} />
            {syncingNow
              ? 'Synchronizing Events...'
              : connection === 'offline'
              ? 'Offline — Connect to Sync'
              : `Sync ${pendingItems.length} Events Now`}
          </Button>
        </div>
      </div>
    </div>
  );
}
