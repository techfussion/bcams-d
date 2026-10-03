/**
 * BCAMS Status Indicators
 * 
 * Reusable status display components used across the application.
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Wifi, WifiOff, RefreshCw, Clock, CheckCircle2, XCircle,
  AlertTriangle, Shield, ShieldAlert, ShieldQuestion, Fingerprint,
} from 'lucide-react';
import type {
  SessionState, SyncStatus, ConnectionStatus, DeviceStatus,
  BiometricEnrollmentStatus, ClockIntegrityStatus, PunctualityClassification,
} from '@/types';

// ─── Session Status ─────────────────────────────────────────────────────────

const sessionStatusConfig: Record<SessionState, { label: string; variant: 'default' | 'success' | 'destructive' | 'warning' | 'muted' }> = {
  draft: { label: 'Draft', variant: 'muted' },
  authorized: { label: 'Authorized', variant: 'warning' },
  active: { label: 'Active', variant: 'success' },
  closed: { label: 'Closed', variant: 'default' },
  expired: { label: 'Expired', variant: 'destructive' },
};

export function SessionStatusBadge({ state }: { state: SessionState }) {
  const config = sessionStatusConfig[state];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ─── Sync Status ────────────────────────────────────────────────────────────

const syncIcons: Record<SyncStatus, React.ReactNode> = {
  synced: <CheckCircle2 className="h-3 w-3" />,
  pending: <Clock className="h-3 w-3" />,
  syncing: <RefreshCw className="h-3 w-3 animate-spinner" />,
  failed: <XCircle className="h-3 w-3" />,
};

const syncVariants: Record<SyncStatus, 'success' | 'pending' | 'syncing' | 'destructive'> = {
  synced: 'success',
  pending: 'pending',
  syncing: 'syncing',
  failed: 'destructive',
};

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  return (
    <Badge variant={syncVariants[status]}>
      {syncIcons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

// ─── Connection Status ──────────────────────────────────────────────────────

export function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {status === 'online' ? (
        <>
          <Wifi className="h-4 w-4 text-success" />
          <span className="text-success-700">Online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Offline</span>
        </>
      )}
    </div>
  );
}

// ─── Device Status ──────────────────────────────────────────────────────────

const deviceStatusConfig: Record<DeviceStatus, { label: string; variant: 'success' | 'warning' | 'destructive' | 'muted' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  active: { label: 'Active', variant: 'success' },
  suspended: { label: 'Suspended', variant: 'warning' },
  revoked: { label: 'Revoked', variant: 'destructive' },
  retired: { label: 'Retired', variant: 'muted' },
};

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const config = deviceStatusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ─── Biometric Status ───────────────────────────────────────────────────────

const biometricStatusConfig: Record<BiometricEnrollmentStatus, { label: string; variant: 'success' | 'warning' | 'destructive' | 'muted' | 'default'; icon: React.ReactNode }> = {
  not_enrolled: { label: 'Not Enrolled', variant: 'muted', icon: <Fingerprint className="h-3 w-3" /> },
  partial: { label: 'Partial', variant: 'warning', icon: <Fingerprint className="h-3 w-3" /> },
  activated: { label: 'Activated', variant: 'default', icon: <Fingerprint className="h-3 w-3" /> },
  complete: { label: 'Complete', variant: 'success', icon: <Fingerprint className="h-3 w-3" /> },
};

export function BiometricStatusBadge({ status }: { status: BiometricEnrollmentStatus }) {
  const config = biometricStatusConfig[status];
  return (
    <Badge variant={config.variant}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

// ─── Clock Integrity ────────────────────────────────────────────────────────

const clockIntegrityConfig: Record<ClockIntegrityStatus, { label: string; icon: React.ReactNode; className: string }> = {
  verified: { label: 'Verified', icon: <Shield className="h-3 w-3" />, className: 'text-success-700' },
  suspicious: { label: 'Suspicious', icon: <ShieldAlert className="h-3 w-3" />, className: 'text-warning-700' },
  unverified: { label: 'Unverified', icon: <ShieldQuestion className="h-3 w-3" />, className: 'text-muted-foreground' },
};

export function ClockIntegrityBadge({ status }: { status: ClockIntegrityStatus }) {
  const config = clockIntegrityConfig[status];
  return (
    <Badge variant={status === 'verified' ? 'success' : status === 'suspicious' ? 'suspicious' : 'unverified'}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

// ─── Punctuality ────────────────────────────────────────────────────────────

export function PunctualityBadge({ classification }: { classification: PunctualityClassification }) {
  return classification === 'on-time' ? (
    <Badge variant="success">✓ On-time</Badge>
  ) : (
    <Badge variant="warning">! Late</Badge>
  );
}

// ─── Scanner Status ─────────────────────────────────────────────────────────

export function ScannerStatusIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`h-2 w-2 rounded-full ${connected ? 'bg-success animate-pulse-ring' : 'bg-muted-foreground'}`} />
      <Fingerprint className={`h-4 w-4 ${connected ? 'text-success' : 'text-muted-foreground'}`} />
      <span className={connected ? 'text-success-700' : 'text-muted-foreground'}>
        {connected ? 'Scanner Connected' : 'Scanner Disconnected'}
      </span>
    </div>
  );
}
